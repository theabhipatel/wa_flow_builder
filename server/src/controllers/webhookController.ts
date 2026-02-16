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

    if (mode !== 'subscribe') {
        console.log('[Webhook] Verification failed — invalid mode');
        res.status(403).send('Forbidden');
        return;
    }

    try {
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            console.log(`[Webhook] Verification failed — no WhatsApp account for bot: ${botId}`);
            res.status(404).send('Bot not found');
            return;
        }

        if (token === waAccount.verifyToken) {
            console.log(`[Webhook] Verification successful for bot: ${botId}`);
            res.status(200).send(challenge);
        } else {
            console.log(`[Webhook] Verification failed — token mismatch for bot: ${botId}`);
            res.status(403).send('Forbidden');
        }
    } catch (error) {
        console.error('[Webhook] Verification error:', error);
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

        if (body.object !== 'whatsapp_business_account') return;

        const entries = body.entry;
        if (!entries || !Array.isArray(entries)) return;

        for (const entry of entries) {
            const changes = entry.changes;
            if (!changes || !Array.isArray(changes)) continue;

            for (const change of changes) {
                if (change.field !== 'messages') continue;

                const value = change.value;
                if (!value?.messages || !Array.isArray(value.messages)) continue;

                const recipientPhoneNumberId: string = value.metadata?.phone_number_id as string;
                if (!recipientPhoneNumberId) continue;

                for (const message of value.messages) {
                    await processIncomingMessage(botId, recipientPhoneNumberId, message);
                }
            }
        }
    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
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
        // Find WhatsApp account by botId (primary) and verify phoneNumberId matches
        const waAccount = await WhatsAppAccount.findOne({ botId });
        if (!waAccount) {
            console.error(`[Webhook] No WhatsApp account found for bot: ${botId}`);
            return;
        }

        if (waAccount.phoneNumberId !== phoneNumberId) {
            console.error(`[Webhook] Phone number ID mismatch for bot: ${botId}`);
            return;
        }

        const senderPhone = message.from;

        // Find bot
        const bot = await Bot.findById(botId);
        if (!bot) {
            console.error(`[Webhook] Bot not found: ${botId}`);
            return;
        }

        // Find the main flow for this bot
        const mainFlow = await Flow.findOne({ botId, isMainFlow: true });
        if (!mainFlow) {
            console.error(`[Webhook] No main flow found for bot ${botId}`);
            return;
        }

        // Find production flow version of the main flow
        const prodVersion = await FlowVersion.findOne({
            flowId: mainFlow._id,
            isProduction: true,
        });

        if (!prodVersion) {
            console.error(`[Webhook] No production flow version for main flow ${mainFlow._id}`);
            return;
        }

        // Find or create session
        const session = await sessionService.findOrCreateSession(
            botId as unknown as Types.ObjectId,
            senderPhone,
            prodVersion._id,
            false
        );

        // Extract message content
        let incomingText: string | undefined;
        let buttonId: string | undefined;

        if (message.type === 'text' && message.text?.body) {
            incomingText = message.text.body;
        } else if (message.type === 'interactive' && message.interactive?.button_reply) {
            buttonId = message.interactive.button_reply.id;
            incomingText = message.interactive.button_reply.title;
        }

        // Execute flow
        await executionService.executeFlow(session, incomingText, buttonId, false);
    } catch (error) {
        console.error(`[Webhook] Error processing message:`, error);
    }
};
