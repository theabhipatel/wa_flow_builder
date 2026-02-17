import { Request, Response, NextFunction } from 'express';
import { Bot, Flow, FlowVersion, Session, Message } from '../models';
import * as executionService from '../services/executionService';
import * as sessionService from '../services/sessionService';

export const sendSimulatorMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { botId, flowId, phoneNumber, message, buttonId } = req.body;

        // Verify ownership
        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        // Get latest draft version
        const draftVersion = await FlowVersion.findOne({ flowId, isDraft: true })
            .sort({ versionNumber: -1 });

        if (!draftVersion) {
            res.status(404).json({ success: false, error: 'No draft version found' });
            return;
        }

        const testPhone = phoneNumber || '+1000000000';

        // Find or create test session
        let session = await sessionService.findOrCreateSession(
            bot._id,
            testPhone,
            draftVersion._id,
            true
        );

        // Handle keywords and fallback before executing flow
        const keywordResult = await executionService.handleIncomingMessageWithKeywords(
            session,
            message,
            buttonId,
            true
        );

        let result;
        if (keywordResult.handled) {
            result = { responses: keywordResult.responses || [] };
            if (keywordResult.newSession) {
                session = keywordResult.newSession;
            }
        } else {
            // Normal flow execution
            result = await executionService.executeFlow(session, message, buttonId, true);
        }

        // Get updated session info
        const updatedSession = await Session.findById(session._id);
        const sessionVars = await import('../models').then((m) =>
            m.SessionVariable.find({ sessionId: session._id })
        );

        res.json({
            success: true,
            data: {
                responses: result.responses,
                session: {
                    id: updatedSession?._id,
                    status: updatedSession?.status,
                    currentNodeId: updatedSession?.currentNodeId,
                },
                variables: sessionVars.map((v) => ({
                    name: v.variableName,
                    value: v.variableValue,
                    type: v.variableType,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const resetSimulatorSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { botId, phoneNumber } = req.body;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const testPhone = phoneNumber || '+1000000000';

        // Close all active sessions for this test
        await Session.updateMany(
            { botId, userPhoneNumber: testPhone, isTest: true, status: { $in: ['ACTIVE', 'PAUSED'] } },
            { status: 'CLOSED', closedAt: new Date() }
        );

        res.json({ success: true, message: 'Simulator session reset' });
    } catch (error) {
        next(error);
    }
};

export const getSimulatorLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { sessionId } = req.params;

        // Load execution logs for the session
        const executionLogs = await import('../models').then((m) =>
            m.ExecutionLog.find({ sessionId }).sort({ executedAt: 1 })
        );

        const messages = await Message.find({ sessionId }).sort({ sentAt: 1 });

        res.json({
            success: true,
            data: {
                executionLogs,
                messages,
            },
        });
    } catch (error) {
        next(error);
    }
};
