import { Request, Response, NextFunction } from 'express';
import { WhatsAppAccount, Bot, Flow, FlowVersion, Session } from '../models';
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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Webhook Verify] Incoming verification request`);
    console.log(`  Bot ID:    ${botId}`);
    console.log(`  Mode:      ${mode}`);
    console.log(`  Token:     ${token ? '***' + String(token).slice(-4) : '(empty)'}`);
    console.log(`  Challenge: ${challenge}`);
    console.log(`${'='.repeat(60)}`);

    if (mode !== 'subscribe') {
        console.log('[Webhook Verify] ❌ FAILED — invalid mode (expected "subscribe")');
        res.status(403).send('Forbidden');
        return;
    }

    try {
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            console.log(`[Webhook Verify] ❌ FAILED — no WhatsApp account found for bot: ${botId}`);
            res.status(404).send('Bot not found');
            return;
        }

        console.log(`[Webhook Verify] Found WhatsApp account for bot: ${botId}`);
        console.log(`  Stored verify token: ***${waAccount.verifyToken.slice(-4)}`);
        console.log(`  Incoming token:      ***${String(token).slice(-4)}`);
        console.log(`  Match: ${token === waAccount.verifyToken ? '✅ YES' : '❌ NO'}`);

        if (token === waAccount.verifyToken) {
            console.log(`[Webhook Verify] ✅ SUCCESS — Responding with challenge`);
            res.status(200).send(challenge);
        } else {
            console.log(`[Webhook Verify] ❌ FAILED — token mismatch`);
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

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[Webhook Message] 📩 Incoming webhook POST for bot: ${botId}`);
        console.log(`  Body object: ${body.object}`);
        console.log(`  Entries count: ${body.entry?.length || 0}`);
        console.log(`  Raw body: ${JSON.stringify(body).substring(0, 500)}`);
        console.log(`${'='.repeat(60)}`);

        if (body.object !== 'whatsapp_business_account') {
            console.log(`[Webhook Message] ⏭️ Skipping — object is "${body.object}", not "whatsapp_business_account"`);
            return;
        }

        const entries = body.entry;
        if (!entries || !Array.isArray(entries)) {
            console.log('[Webhook Message] ⏭️ Skipping — no entries array');
            return;
        }

        for (const entry of entries) {
            const changes = entry.changes;
            if (!changes || !Array.isArray(changes)) {
                console.log(`[Webhook Message] ⏭️ Entry ${entry.id} — no changes array`);
                continue;
            }

            for (const change of changes) {
                console.log(`[Webhook Message] Change field: "${change.field}"`);

                if (change.field !== 'messages') {
                    console.log(`[Webhook Message] ⏭️ Skipping change — field is "${change.field}", not "messages"`);
                    continue;
                }

                const value = change.value;
                console.log(`[Webhook Message] Messaging product: ${value?.messaging_product}`);
                console.log(`[Webhook Message] Phone number ID from metadata: ${value?.metadata?.phone_number_id}`);
                console.log(`[Webhook Message] Display phone: ${value?.metadata?.display_phone_number}`);
                console.log(`[Webhook Message] Messages count: ${value?.messages?.length || 0}`);
                console.log(`[Webhook Message] Statuses count: ${value?.statuses?.length || 0}`);

                if (!value?.messages || !Array.isArray(value.messages)) {
                    console.log('[Webhook Message] ⏭️ No messages in this change (might be a status update)');
                    continue;
                }

                const recipientPhoneNumberId: string = value.metadata?.phone_number_id as string;
                if (!recipientPhoneNumberId) {
                    console.log('[Webhook Message] ❌ No phone_number_id in metadata');
                    continue;
                }

                for (const message of value.messages) {
                    console.log(`\n[Webhook Message] 📨 Processing message:`);
                    console.log(`  From: ${message.from}`);
                    console.log(`  Type: ${message.type}`);
                    console.log(`  Timestamp: ${message.timestamp}`);
                    if (message.text) console.log(`  Text: "${message.text.body}"`);
                    if (message.interactive) console.log(`  Interactive: ${JSON.stringify(message.interactive)}`);

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
        interactive?: { type: string; button_reply?: { id: string; title: string } };
        timestamp: string;
    }
): Promise<void> => {
    try {
        console.log(`\n[Process Message] 🔄 Starting message processing for bot: ${botId}`);

        // Step 1: Find WhatsApp account
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            console.error(`[Process Message] ❌ No WhatsApp account found for bot: ${botId}`);
            return;
        }
        console.log(`[Process Message] ✅ Found WhatsApp account`);
        console.log(`  Stored phone number ID: ${waAccount.phoneNumberId}`);
        console.log(`  Incoming phone number ID: ${phoneNumberId}`);

        if (waAccount.phoneNumberId !== phoneNumberId) {
            console.error(`[Process Message] ❌ Phone number ID mismatch!`);
            console.error(`  Stored: ${waAccount.phoneNumberId}`);
            console.error(`  Incoming: ${phoneNumberId}`);
            return;
        }
        console.log(`[Process Message] ✅ Phone number ID matches`);

        const senderPhone = message.from;

        // Step 2: Find bot
        const bot = await Bot.findById(botId);
        if (!bot) {
            console.error(`[Process Message] ❌ Bot not found: ${botId}`);
            return;
        }
        console.log(`[Process Message] ✅ Found bot: "${bot.name}" (ID: ${botId})`);
        console.log(`  Active flow ID: ${bot.activeFlowId || '(none)'}`);

        // Step 3: Find main flow
        const mainFlow = await Flow.findOne({ botId, isMainFlow: true });
        if (!mainFlow) {
            console.error(`[Process Message] ❌ No main flow found for bot "${bot.name}" (${botId})`);
            console.error(`  Hint: Make sure the bot has a flow marked as "main flow"`);
            return;
        }
        console.log(`[Process Message] ✅ Found main flow: "${mainFlow.name}" (ID: ${mainFlow._id})`);

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
        console.log(`[Process Message] ✅ Found production version: v${prodVersion.versionNumber}`);
        console.log(`  Nodes: ${prodVersion.flowData?.nodes?.length || 0}`);
        console.log(`  Edges: ${prodVersion.flowData?.edges?.length || 0}`);

        // Step 5: Find or create session
        let session = await sessionService.findOrCreateSession(
            botId as unknown as Types.ObjectId,
            senderPhone,
            prodVersion._id,
            false
        );

        // Step 5b: Check if session's flow version is still current
        // If the flow was re-deployed, the old session may be stuck on a stale version
        if (session.flowVersionId?.toString() !== prodVersion._id.toString()) {
            console.log(`[Process Message] ⚠️ Session uses flow version ${session.flowVersionId} but production is ${prodVersion._id}`);
            console.log(`  Closing stale session and creating a fresh one...`);
            await sessionService.closeSession(session._id);
            session = await sessionService.findOrCreateSession(
                botId as unknown as Types.ObjectId,
                senderPhone,
                prodVersion._id,
                false
            );
        }

        console.log(`[Process Message] ✅ Session ready`);
        console.log(`  Session ID: ${session._id}`);
        console.log(`  Status: ${session.status}`);
        console.log(`  Current node: ${session.currentNodeId}`);
        console.log(`  Flow version: ${session.flowVersionId}`);
        console.log(`  Is new session: ${session.createdAt && (Date.now() - new Date(session.createdAt).getTime()) < 2000 ? 'YES (just created)' : 'NO (existing)'}`);

        // Step 6: Extract message content
        let incomingText: string | undefined;
        let buttonId: string | undefined;

        if (message.type === 'text' && message.text?.body) {
            incomingText = message.text.body;
        } else if (message.type === 'interactive' && message.interactive?.button_reply) {
            buttonId = message.interactive.button_reply.id;
            incomingText = message.interactive.button_reply.title;
        }
        console.log(`[Process Message] 📝 Extracted content:`);
        console.log(`  Text: "${incomingText || '(none)'}"`);
        console.log(`  Button ID: "${buttonId || '(none)'}"`);

        // Step 7: Handle keywords and fallback before executing flow
        console.log(`[Process Message] 🚀 Checking for restart keywords / fallback...`);
        const keywordResult = await executionService.handleIncomingMessageWithKeywords(
            session,
            incomingText,
            buttonId,
            false
        );

        if (keywordResult.handled) {
            console.log(`[Process Message] ✅ Message handled by keyword/fallback logic`);
            if (keywordResult.newSession) {
                session = keywordResult.newSession;
            }
        } else {
            // Normal flow execution
            console.log(`[Process Message] 🚀 Executing flow normally...`);
            const result = await executionService.executeFlow(session, incomingText, buttonId, false);
            console.log(`[Process Message] ✅ Flow execution complete`);
            console.log(`  Responses sent: ${result.responses.length}`);
        }

        // Check updated session state
        const updatedSession = await Session.findById(session._id);
        if (updatedSession) {
            console.log(`[Process Message] 📊 Updated session state:`);
            console.log(`  Status: ${updatedSession.status}`);
            console.log(`  Current node: ${updatedSession.currentNodeId}`);
        }

    } catch (error) {
        console.error(`[Process Message] ❌ Error processing message for bot ${botId}:`, error);
    }
};
