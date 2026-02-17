import { Session, FlowVersion, Message, SessionVariable, BotVariable } from '../models';
import { Types } from 'mongoose';
import { ISession } from '../types';

/**
 * Find or create a session for a bot + user phone number
 */
export const findOrCreateSession = async (
    botId: Types.ObjectId,
    userPhoneNumber: string,
    flowVersionId: Types.ObjectId,
    isTest: boolean = false
): Promise<ISession> => {
    console.log(`[Session] Looking for existing session: bot=${botId}, phone=${userPhoneNumber}, test=${isTest}`);

    // Look for an existing active/paused session
    let session = await Session.findOne({
        botId,
        userPhoneNumber,
        status: { $in: ['ACTIVE', 'PAUSED'] },
    }).sort({ createdAt: -1 });

    if (session) {
        console.log(`[Session] ✅ Found existing session: ${session._id} (status: ${session.status}, currentNode: ${session.currentNodeId})`);
        return session;
    }

    console.log(`[Session] No existing session found — creating new one`);

    // Create a new session
    const flowVersion = await FlowVersion.findById(flowVersionId);
    if (!flowVersion) {
        console.error(`[Session] ❌ Flow version not found: ${flowVersionId}`);
        throw new Error('Flow version not found');
    }

    // Find the Start node
    const flowData = flowVersion.flowData;
    const startNode = flowData.nodes.find((n) => n.nodeType === 'START');
    if (!startNode) {
        console.error(`[Session] ❌ Flow has no START node! Node types found: ${flowData.nodes.map(n => n.nodeType).join(', ')}`);
        throw new Error('Flow has no Start node');
    }

    session = await Session.create({
        botId,
        flowVersionId,
        userPhoneNumber,
        currentNodeId: startNode.nodeId,
        status: 'ACTIVE',
        isTest,
    });

    console.log(`[Session] ✅ Created new session: ${session._id} (startNode: ${startNode.nodeId})`);
    return session;
};

/**
 * Update session state
 */
export const updateSessionState = async (
    sessionId: Types.ObjectId,
    update: Partial<ISession>
): Promise<void> => {
    await Session.findByIdAndUpdate(sessionId, {
        ...update,
        updatedAt: new Date(),
    });
};

/**
 * Close a session
 */
export const closeSession = async (sessionId: Types.ObjectId): Promise<void> => {
    await Session.findByIdAndUpdate(sessionId, {
        status: 'CLOSED',
        closedAt: new Date(),
        updatedAt: new Date(),
    });
};

/**
 * Get conversation history for a session (for AI node)
 */
export const getConversationHistory = async (
    sessionId: Types.ObjectId,
    limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> => {
    const messages = await Message.find({ sessionId })
        .sort({ sentAt: -1 })
        .limit(limit);

    return messages
        .reverse()
        .map((msg) => ({
            role: (msg.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.messageContent || '',
        }));
};
