import { Request, Response, NextFunction } from 'express';
import { WhatsAppAccount, Bot, Flow, FlowVersion, Session, ConversationMessage } from '../models';
import { decrypt } from '../utils/encryption';
import * as executionService from '../services/executionService';
import * as sessionService from '../services/sessionService';
import { Types } from 'mongoose';

/**
 * GET /api/webhook/whatsapp/:botId — Webhook verification (per-bot)
 */
export const verifyWebhook = async (req: Request, res: Response): Promise<void> => {
    const { botId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];


    if (mode !== 'subscribe') {
        res.status(403).send('Forbidden');
        return;
    }

    try {
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            res.status(404).send('Bot not found');
            return;
        }


        if (token === waAccount.verifyToken) {
            res.status(200).send(challenge);
        } else {
            res.status(403).send('Forbidden');
        }
    } catch (error) {
        console.error('[Webhook Verify] ❌ ERROR:', error);
        res.status(500).send('Internal Server Error');
    }
};

/**
 * POST /api/webhook/whatsapp/:botId — Handle incoming messages (per-bot)
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
    // Return 200 immediately (async processing)
    res.status(200).send('EVENT_RECEIVED');

    try {
        const { botId } = req.params;
        const body = req.body;


        if (body.object !== 'whatsapp_business_account') {
            return;
        }

        const entries = body.entry;
        if (!entries || !Array.isArray(entries)) {
            return;
        }

        for (const entry of entries) {
            const changes = entry.changes;
            if (!changes || !Array.isArray(changes)) {
                continue;
            }

            for (const change of changes) {

                if (change.field !== 'messages') {
                    continue;
                }

                const value = change.value;

                if (!value?.messages || !Array.isArray(value.messages)) {
                    continue;
                }

                const recipientPhoneNumberId: string = value.metadata?.phone_number_id as string;
                if (!recipientPhoneNumberId) {
                    continue;
                }

                for (const message of value.messages) {

                    await processIncomingMessage(botId as string, recipientPhoneNumberId, message);
                }
            }
        }
    } catch (error) {
        console.error('[Webhook Message] ❌ Error processing webhook:', error);
    }
};

const processIncomingMessage = async (
    botId: string,
    phoneNumberId: string,
    message: {
        from: string;
        type: string;
        text?: { body: string };
        interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string; description?: string } };
        timestamp: string;
    }
): Promise<void> => {
    try {

        // Step 1: Find WhatsApp account
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            console.error(`[Process Message] ❌ No WhatsApp account found for bot: ${botId}`);
            return;
        }

        if (waAccount.phoneNumberId !== phoneNumberId) {
            console.error(`[Process Message] ❌ Phone number ID mismatch!`);
            console.error(`  Stored: ${waAccount.phoneNumberId}`);
            console.error(`  Incoming: ${phoneNumberId}`);
            return;
        }

        const senderPhone = message.from;

        // Step 2: Find bot
        const bot = await Bot.findById(botId);
        if (!bot) {
            console.error(`[Process Message] ❌ Bot not found: ${botId}`);
            return;
        }

        // Step 3: Find main flow
        const mainFlow = await Flow.findOne({ botId, isMainFlow: true });
        if (!mainFlow) {
            console.error(`[Process Message] ❌ No main flow found for bot "${bot.name}" (${botId})`);
            console.error(`  Hint: Make sure the bot has a flow marked as "main flow"`);
            return;
        }

        // Step 4: Find production flow version
        const prodVersion = await FlowVersion.findOne({
            flowId: mainFlow._id,
            isProduction: true,
        });

        if (!prodVersion) {
            console.error(`[Process Message] ❌ No PRODUCTION flow version found for flow "${mainFlow.name}" (${mainFlow._id})`);
            console.error(`  Hint: You need to DEPLOY the flow first (click "Deploy" in the flow builder)`);
            // List all versions for debugging
            const allVersions = await FlowVersion.find({ flowId: mainFlow._id }).select('versionNumber isDraft isProduction createdAt');
            console.error(`  Available versions:`);
            for (const v of allVersions) {
                console.error(`    v${v.versionNumber} — draft: ${v.isDraft}, production: ${v.isProduction}, created: ${v.createdAt}`);
            }
            return;
        }

        // Step 5: Find or create session
        let session = await sessionService.findOrCreateSession(
            botId as unknown as Types.ObjectId,
            senderPhone,
            prodVersion._id,
            false
        );

        // Step 5b: Check if session's flow version is still current
        // If the flow was re-deployed, the old session may be stuck on a stale version
        // BUT: if the session is currently inside a subflow, its flowVersionId will be the
        // subflow's version — that's expected, so skip the stale check in that case.
        const isInsideSubflow = session.subflowCallStack && session.subflowCallStack.length > 0;
        if (!isInsideSubflow && session.flowVersionId?.toString() !== prodVersion._id.toString()) {
            await sessionService.closeSession(session._id);
            session = await sessionService.findOrCreateSession(
                botId as unknown as Types.ObjectId,
                senderPhone,
                prodVersion._id,
                false
            );
        } else if (isInsideSubflow) {
        }


        // Step 6: Extract message content
        let incomingText: string | undefined;
        let buttonId: string | undefined;

        if (message.type === 'text' && message.text?.body) {
            incomingText = message.text.body;
        } else if (message.type === 'interactive' && message.interactive?.button_reply) {
            buttonId = message.interactive.button_reply.id;
            incomingText = message.interactive.button_reply.title;
        } else if (message.type === 'interactive' && message.interactive?.list_reply) {
            buttonId = message.interactive.list_reply.id;
            incomingText = message.interactive.list_reply.title;
        }

        // Step 6b: Log incoming user message to permanent ConversationMessage table
        if (incomingText) {
            try {
                await ConversationMessage.create({
                    botId,
                    userPhoneNumber: senderPhone,
                    sender: 'USER',
                    messageType: 'TEXT',
                    messageContent: incomingText,
                    sentAt: new Date(),
                });
            } catch (err) {
                console.error('[Process Message] Failed to log conversation message:', err);
            }
        }

        // Step 7: Handle keywords and fallback before executing flow
        const keywordResult = await executionService.handleIncomingMessageWithKeywords(
            session,
            incomingText,
            buttonId,
            false
        );

        if (keywordResult.handled) {
            if (keywordResult.newSession) {
                session = keywordResult.newSession;
            }
        } else {
            // Normal flow execution
            const result = await executionService.executeFlow(session, incomingText, buttonId, false);
        }

        // Check updated session state
        const updatedSession = await Session.findById(session._id);
        if (updatedSession) {
        }

    } catch (error) {
        console.error(`[Process Message] ❌ Error processing message for bot ${botId}:`, error);
    }
};
