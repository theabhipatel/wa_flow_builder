import { Types } from 'mongoose';
import { Flow, FlowVersion, Session, Message, ExecutionLog, OpenAIAccount, WhatsAppAccount } from '../models';
import {
    IFlowNode,
    IFlowData,
    ISession,
    IMessageNodeConfig,
    IButtonNodeConfig,
    IInputNodeConfig,
    IConditionNodeConfig,
    IDelayNodeConfig,
    IApiNodeConfig,
    IAiNodeConfig,
    ILoopNodeConfig,
    IEndNodeConfig,
    IStartNodeConfig,
    IGotoSubflowNodeConfig,
} from '../types';
import { resolveVariables, setSessionVariable, getVariableMap } from '../utils/variableResolver';
import { decrypt } from '../utils/encryption';
import * as whatsappService from './whatsappService';
import * as openaiService from './openaiService';
import * as sessionService from './sessionService';
import axios from 'axios';

interface IExecutionContext {
    session: ISession;
    flowData: IFlowData;
    incomingMessage?: string;
    incomingButtonId?: string;
    phoneNumberId?: string;
    accessToken?: string;
    isSimulator: boolean;
    simulatorResponses: Array<{ type: string; content: string; buttons?: Array<{ id: string; label: string }> }>;
}

/**
 * Main flow execution entry point
 */
export const executeFlow = async (
    session: ISession,
    incomingMessage?: string,
    incomingButtonId?: string,
    isSimulator: boolean = false
): Promise<{ responses: Array<{ type: string; content: string; buttons?: Array<{ id: string; label: string }> }> }> => {
    const mode = isSimulator ? '🧪 SIMULATOR' : '📱 WHATSAPP';
    console.log(`\n[Execution] ${mode} — executeFlow called`);
    console.log(`  Session ID: ${session._id}`);
    console.log(`  Current node: ${session.currentNodeId}`);
    console.log(`  Incoming message: "${incomingMessage || '(none)'}"`);
    console.log(`  Incoming button ID: "${incomingButtonId || '(none)'}"`);

    // Load flow version
    const flowVersion = await FlowVersion.findById(session.flowVersionId);
    if (!flowVersion) {
        console.error(`[Execution] ❌ Flow version not found: ${session.flowVersionId}`);
        throw new Error('Flow version not found');
    }
    console.log(`[Execution] ✅ Loaded flow version v${flowVersion.versionNumber} (nodes: ${flowVersion.flowData?.nodes?.length}, edges: ${flowVersion.flowData?.edges?.length})`);

    // Get WhatsApp credentials if not simulator
    let phoneNumberId: string | undefined;
    let accessToken: string | undefined;

    if (!isSimulator) {
        const waAccount = await WhatsAppAccount.findOne({ botId: session.botId });
        if (waAccount) {
            phoneNumberId = waAccount.phoneNumberId;
            accessToken = decrypt(waAccount.accessToken);
            console.log(`[Execution] ✅ WhatsApp credentials loaded (phoneNumberId: ${phoneNumberId})`);
        } else {
            console.error(`[Execution] ❌ No WhatsApp account found — cannot send messages!`);
        }
    }

    const context: IExecutionContext = {
        session,
        flowData: flowVersion.flowData,
        incomingMessage,
        incomingButtonId,
        phoneNumberId,
        accessToken,
        isSimulator,
        simulatorResponses: [],
    };

    // Log incoming user message
    if (incomingMessage) {
        await Message.create({
            sessionId: session._id,
            sender: 'USER',
            messageType: 'TEXT',
            messageContent: incomingMessage,
            sentAt: new Date(),
        });
    }

    // Execute the current node
    await executeNode(context);

    console.log(`[Execution] ${mode} — Flow execution finished. Simulator responses: ${context.simulatorResponses.length}`);
    return { responses: context.simulatorResponses };
};

// ============================================================
// RESTART KEYWORDS & GLOBAL FALLBACK HANDLER
// ============================================================

const RESTART_KEYWORDS = ['hi', 'hello'];
const DEFAULT_FALLBACK_MESSAGE = "I didn't understand. Please choose an option or send Hi to start again.";

/**
 * Intercepts incoming messages to handle restart keywords and global fallback.
 * Called by both webhookController and simulatorController before executeFlow.
 *
 * Returns: { handled: true, responses } if the message was intercepted (restart or fallback),
 *          { handled: false } if the message should proceed to executeFlow normally.
 */
export const handleIncomingMessageWithKeywords = async (
    session: ISession,
    incomingText: string | undefined,
    incomingButtonId: string | undefined,
    isSimulator: boolean
): Promise<{
    handled: boolean;
    responses?: Array<{ type: string; content: string; buttons?: Array<{ id: string; label: string }> }>;
    newSession?: ISession;
}> => {
    // If it's a button click, skip keyword/fallback logic entirely — let executeFlow handle it
    if (incomingButtonId) {
        return { handled: false };
    }

    // If no text message, nothing to intercept
    if (!incomingText) {
        return { handled: false };
    }

    // Load the current node to determine context
    const flowVersion = await FlowVersion.findById(session.flowVersionId);
    if (!flowVersion) {
        return { handled: false };
    }

    const currentNode = flowVersion.flowData.nodes.find(
        (n) => n.nodeId === session.currentNodeId
    );

    // 1. INPUT node — allow all text through as-is (captures user input)
    if (currentNode && currentNode.nodeType === 'INPUT') {
        console.log(`[Keywords] Current node is INPUT — bypassing keyword check, capturing input as-is`);
        return { handled: false };
    }

    // 2. Check for restart keywords
    const normalizedText = incomingText.trim().toLowerCase();
    if (RESTART_KEYWORDS.includes(normalizedText)) {
        console.log(`[Keywords] 🔄 Restart keyword detected: "${incomingText}" — restarting flow`);

        // Close the current session
        await sessionService.closeSession(session._id);

        // Find the flow version to create a new session from
        const newSession = await sessionService.findOrCreateSession(
            session.botId,
            session.userPhoneNumber,
            flowVersion._id,
            session.isTest
        );

        // Execute from the START node (no incoming message — triggers the first flow message)
        const result = await executeFlow(newSession, undefined, undefined, isSimulator);

        return { handled: true, responses: result.responses, newSession };
    }

    // 3. At any non-INPUT node and user sent text (not a keyword) → send fallback
    //    This covers: BUTTON (waiting for click), MESSAGE (flow ended), and any other node
    if (currentNode) {
        console.log(`[Keywords] ⚠️ Unexpected text at ${currentNode.nodeType} node — sending fallback message`);

        // Load the bot's custom fallback message
        const { Bot } = await import('../models');
        const bot = await Bot.findById(session.botId);
        const fallbackMessage = bot?.defaultFallbackMessage || DEFAULT_FALLBACK_MESSAGE;

        // Log user message
        await Message.create({
            sessionId: session._id,
            sender: 'USER',
            messageType: 'TEXT',
            messageContent: incomingText,
            sentAt: new Date(),
        });

        if (isSimulator) {
            // Log bot fallback message
            await Message.create({
                sessionId: session._id,
                sender: 'BOT',
                messageType: 'TEXT',
                messageContent: fallbackMessage,
                sentAt: new Date(),
            });
            return { handled: true, responses: [{ type: 'text', content: fallbackMessage }] };
        } else {
            // Send via WhatsApp
            const waAccount = await WhatsAppAccount.findOne({ botId: session.botId });
            if (waAccount) {
                const accessToken = decrypt(waAccount.accessToken);
                await whatsappService.sendTextMessage(
                    waAccount.phoneNumberId,
                    accessToken,
                    session.userPhoneNumber,
                    fallbackMessage
                );
            }
            // Log bot fallback message
            await Message.create({
                sessionId: session._id,
                sender: 'BOT',
                messageType: 'TEXT',
                messageContent: fallbackMessage,
                sentAt: new Date(),
            });
            return { handled: true, responses: [] };
        }
    }

    // 4. Not at INPUT, not a keyword, not at BUTTON — let executeFlow handle normally
    return { handled: false };
};

/**
 * Execute a single node and potentially chain to the next
 */
const executeNode = async (context: IExecutionContext): Promise<void> => {
    const { session, flowData } = context;
    const currentNodeId = session.currentNodeId;

    if (!currentNodeId) {
        console.log(`[Execution] ⚠️ No current node ID — stopping`);
        return;
    }

    const node = flowData.nodes.find((n) => n.nodeId === currentNodeId);
    if (!node) {
        console.error(`[Execution] ❌ Node "${currentNodeId}" not found in flow data`);
        console.error(`  Available nodes: ${flowData.nodes.map(n => `${n.nodeId}(${n.nodeType})`).join(', ')}`);
        await sessionService.updateSessionState(session._id, { status: 'FAILED' });
        return;
    }

    console.log(`[Execution] ▶️ Executing node: "${node.nodeId}" (type: ${node.nodeType})`);

    const startTime = Date.now();
    let nextNodeId: string | undefined;
    let error: string | undefined;

    try {
        switch (node.nodeType) {
            case 'START':
                nextNodeId = await executeStartNode(context, node);
                break;
            case 'MESSAGE':
                nextNodeId = await executeMessageNode(context, node);
                break;
            case 'BUTTON':
                nextNodeId = await executeButtonNode(context, node);
                break;
            case 'INPUT':
                nextNodeId = await executeInputNode(context, node);
                break;
            case 'CONDITION':
                nextNodeId = await executeConditionNode(context, node);
                break;
            case 'DELAY':
                nextNodeId = await executeDelayNode(context, node);
                break;
            case 'API':
                nextNodeId = await executeApiNode(context, node);
                break;
            case 'AI':
                nextNodeId = await executeAiNode(context, node);
                break;
            case 'LOOP':
                nextNodeId = await executeLoopNode(context, node);
                break;
            case 'END':
                await executeEndNode(context, node);
                console.log(`[Execution] 🏁 END node reached — stopping`);
                return; // Stop execution
            case 'GOTO_SUBFLOW':
                nextNodeId = await executeGotoSubflowNode(context, node);
                break;
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error(`[Execution] ❌ Error in node "${node.nodeId}" (${node.nodeType}):`, error);
    }

    // Log execution
    const duration = Date.now() - startTime;
    await ExecutionLog.create({
        sessionId: session._id,
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        executionDuration: duration,
        nextNodeId,
        error,
        executedAt: new Date(),
    });

    console.log(`[Execution] ${node.nodeType} "${node.nodeId}" → next: "${nextNodeId || '(none/paused)'}" (${duration}ms)`);

    // If we have a next node, continue execution
    if (nextNodeId && !error) {
        session.currentNodeId = nextNodeId;
        await sessionService.updateSessionState(session._id, { currentNodeId: nextNodeId });

        const nextNode = flowData.nodes.find((n) => n.nodeId === nextNodeId);
        if (nextNode) {
            // Always execute the next node — pausing nodes (BUTTON, INPUT) handle their
            // own pause logic internally by sending their prompt and returning undefined
            console.log(`[Execution] ➡️ Chaining to next node: "${nextNodeId}" (${nextNode.nodeType})`);
            await executeNode(context);
        }
    } else if (!nextNodeId && !error) {
        // No next node — check if we need to return from a subflow
        console.log(`[Execution] 🔚 No next node — checking for subflow return`);
        await handleSubflowReturn(context);
    }
};

const isPausingNode = (nodeType: string): boolean => {
    return ['BUTTON', 'INPUT'].includes(nodeType);
};

// ============================================================
// NODE EXECUTORS
// ============================================================

const executeStartNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = (node.config || {}) as IStartNodeConfig;
    // Find next node from edges
    const nextEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
    const nextNodeId = config?.nextNodeId || nextEdge?.targetNodeId;
    console.log(`[Execution] START node → nextNodeId from config: ${config?.nextNodeId || '(none)'}, from edge: ${nextEdge?.targetNodeId || '(none)'}`);
    return nextNodeId;
};

const executeMessageNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IMessageNodeConfig;

    // Resolve variables in message
    const messageText = config.text || config.messageContent || '';
    const resolvedMessage = await resolveVariables(
        messageText,
        context.session._id,
        context.session.botId
    );

    // Send message
    if (context.isSimulator) {
        context.simulatorResponses.push({ type: 'text', content: resolvedMessage });
    } else if (context.phoneNumberId && context.accessToken) {
        await whatsappService.sendTextMessage(
            context.phoneNumberId,
            context.accessToken,
            context.session.userPhoneNumber,
            resolvedMessage
        );
    }

    // Log bot message
    await Message.create({
        sessionId: context.session._id,
        sender: 'BOT',
        messageType: 'TEXT',
        messageContent: resolvedMessage,
        nodeId: node.nodeId,
        sentAt: new Date(),
    });

    const nextEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
    return config.nextNodeId || nextEdge?.targetNodeId;
};

const executeButtonNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IButtonNodeConfig;

    // If we are at this node for the first time (no incoming button click), send the button message
    if (!context.incomingButtonId) {
        const resolvedText = config.messageText
            ? await resolveVariables(config.messageText, context.session._id, context.session.botId)
            : 'Please select an option:';

        if (context.isSimulator) {
            context.simulatorResponses.push({
                type: 'button',
                content: resolvedText,
                buttons: config.buttons.map((b) => ({ id: b.buttonId, label: b.label })),
            });
        } else if (context.phoneNumberId && context.accessToken) {
            await whatsappService.sendButtonMessage(
                context.phoneNumberId,
                context.accessToken,
                context.session.userPhoneNumber,
                resolvedText,
                config.buttons
            );
        }

        // Log bot message
        await Message.create({
            sessionId: context.session._id,
            sender: 'BOT',
            messageType: 'BUTTON',
            messageContent: resolvedText,
            nodeId: node.nodeId,
            sentAt: new Date(),
        });

        // Pause and wait for user click — session stays at this node
        await sessionService.updateSessionState(context.session._id, {
            currentNodeId: node.nodeId,
            status: 'PAUSED',
        });

        return undefined; // Pause execution
    }

    // We have a button click response — find the next node via edges using sourceHandle
    const matchedEdge = context.flowData.edges.find(
        (e) => e.sourceNodeId === node.nodeId && e.sourceHandle === context.incomingButtonId
    );

    if (matchedEdge) {
        await sessionService.updateSessionState(context.session._id, { status: 'ACTIVE' });
        context.incomingButtonId = undefined; // Consume the click
        context.incomingMessage = undefined; // Consume any associated text
        return matchedEdge.targetNodeId;
    }

    // Fallback: try matching by button config
    const clickedButton = config.buttons?.find((b: { buttonId: string }) => b.buttonId === context.incomingButtonId);
    if (clickedButton) {
        const storeIn = (clickedButton as unknown as { storeIn?: string }).storeIn;
        if (storeIn) {
            await setSessionVariable(context.session._id, storeIn, clickedButton.label, 'STRING');
        }
        await sessionService.updateSessionState(context.session._id, { status: 'ACTIVE' });
        context.incomingButtonId = undefined;
        context.incomingMessage = undefined; // Consume any associated text
        const nextNodeId2 = (clickedButton as unknown as { nextNodeId?: string }).nextNodeId;
        return nextNodeId2;
    }

    // Text response when button expected → fallback
    if (context.incomingMessage && config.fallback) {
        const fallbackMsg = config.fallback.message
            ? await resolveVariables(config.fallback.message, context.session._id, context.session.botId)
            : 'Please click one of the buttons above.';

        if (context.isSimulator) {
            context.simulatorResponses.push({ type: 'text', content: fallbackMsg });
        } else if (context.phoneNumberId && context.accessToken) {
            await whatsappService.sendTextMessage(
                context.phoneNumberId,
                context.accessToken,
                context.session.userPhoneNumber,
                fallbackMsg
            );
        }

        return config.fallback.nextNodeId || node.nodeId; // Re-send or loop
    }

    return undefined;
};

const executeInputNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IInputNodeConfig;

    // If no incoming message, send the prompt
    if (!context.incomingMessage) {
        const promptText = config.promptText || config.promptMessage || '';
        const resolvedPrompt = await resolveVariables(
            promptText,
            context.session._id,
            context.session.botId
        );

        if (context.isSimulator) {
            context.simulatorResponses.push({ type: 'text', content: resolvedPrompt });
        } else if (context.phoneNumberId && context.accessToken) {
            await whatsappService.sendTextMessage(
                context.phoneNumberId,
                context.accessToken,
                context.session.userPhoneNumber,
                resolvedPrompt
            );
        }

        await Message.create({
            sessionId: context.session._id,
            sender: 'BOT',
            messageType: 'TEXT',
            messageContent: resolvedPrompt,
            nodeId: node.nodeId,
            sentAt: new Date(),
        });

        await sessionService.updateSessionState(context.session._id, {
            currentNodeId: node.nodeId,
            status: 'PAUSED',
        });

        return undefined; // Pause
    }

    // Validate input
    const input = context.incomingMessage;
    const isValid = validateInput(input, config);

    if (isValid) {
        // Store in variable
        let value: unknown = input;
        if (config.inputType === 'NUMBER') {
            value = parseFloat(input);
        }
        await setSessionVariable(context.session._id, config.variableName, value, config.inputType === 'NUMBER' ? 'NUMBER' : 'STRING');
        await sessionService.updateSessionState(context.session._id, { status: 'ACTIVE' });
        context.incomingMessage = undefined; // Consume
        // Check config first, then fall back to edges
        const nextEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
        return config.successNextNodeId || nextEdge?.targetNodeId;
    }

    // Invalid input — retry logic
    const retryCountVar = `__retry_${node.nodeId}`;
    const vars = await getVariableMap(context.session._id, context.session.botId);
    const currentRetries = (vars[retryCountVar] as number) || 0;
    const maxRetries = config.retryConfig?.maxRetries || 3;

    if (currentRetries >= maxRetries) {
        // Max retries reached
        await setSessionVariable(context.session._id, retryCountVar, 0, 'NUMBER');
        await sessionService.updateSessionState(context.session._id, { status: 'ACTIVE' });
        // Check config first, then fall back to edges
        const failEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
        return config.retryConfig?.failureNextNodeId || failEdge?.targetNodeId;
    }

    // Increment retries and send retry message
    await setSessionVariable(context.session._id, retryCountVar, currentRetries + 1, 'NUMBER');

    const retryMsg = config.retryConfig?.retryMessage || 'Invalid input. Please try again.';
    const resolvedRetryMsg = await resolveVariables(retryMsg, context.session._id, context.session.botId);

    if (context.isSimulator) {
        context.simulatorResponses.push({ type: 'text', content: resolvedRetryMsg });
    } else if (context.phoneNumberId && context.accessToken) {
        await whatsappService.sendTextMessage(
            context.phoneNumberId,
            context.accessToken,
            context.session.userPhoneNumber,
            resolvedRetryMsg
        );
    }

    return undefined; // Stay on same node, keep waiting
};

const validateInput = (input: string, config: IInputNodeConfig): boolean => {
    switch (config.inputType) {
        case 'EMAIL':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
        case 'PHONE':
            return /^\+?[1-9]\d{1,14}$/.test(input);
        case 'NUMBER': {
            const num = parseFloat(input);
            if (isNaN(num)) return false;
            if (config.validation?.minLength !== undefined && num < config.validation.minLength) return false;
            if (config.validation?.maxLength !== undefined && num > config.validation.maxLength) return false;
            return true;
        }
        case 'CUSTOM_REGEX':
            if (config.validation?.regexPattern) {
                return new RegExp(config.validation.regexPattern).test(input);
            }
            return true;
        case 'TEXT':
        default: {
            if (config.validation?.minLength && input.length < config.validation.minLength) return false;
            if (config.validation?.maxLength && input.length > config.validation.maxLength) return false;
            return true;
        }
    }
};

const executeConditionNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IConditionNodeConfig;
    const vars = await getVariableMap(context.session._id, context.session.botId);

    // Add the incoming message as a special variable
    if (context.incomingMessage) {
        vars['lastMessage'] = context.incomingMessage;
    }

    // If we have leftOperand/operator/rightOperand (frontend simple mode)
    if (config.leftOperand && config.operator) {
        const resolvedLeft = await resolveVariables(config.leftOperand, context.session._id, context.session.botId);
        const right = config.rightOperand || '';
        let result = false;
        switch (config.operator) {
            case 'equals': result = resolvedLeft === right; break;
            case 'not_equals': result = resolvedLeft !== right; break;
            case 'contains': result = resolvedLeft.toLowerCase().includes(right.toLowerCase()); break;
            case 'greater_than': result = parseFloat(resolvedLeft) > parseFloat(right); break;
            case 'less_than': result = parseFloat(resolvedLeft) < parseFloat(right); break;
            case 'regex_match': result = new RegExp(right).test(resolvedLeft); break;
            default: result = resolvedLeft === right;
        }

        // Use edges: 'true' handle goes to true branch, 'false' handle to false branch
        const trueEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId && e.sourceHandle === 'true');
        const falseEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId && e.sourceHandle === 'false');
        // Fallback: generic edge
        const genericEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId && !e.sourceHandle);

        if (result) {
            return trueEdge?.targetNodeId || genericEdge?.targetNodeId;
        } else {
            return falseEdge?.targetNodeId || genericEdge?.targetNodeId;
        }
    }

    // Legacy: Evaluate branches top-to-bottom
    if (config.branches) {
        for (const branch of config.branches) {
            if (evaluateExpression(branch.expression, vars)) {
                return branch.nextNodeId;
            }
        }
    }

    // Default branch
    return config.defaultBranch?.nextNodeId;
};

const evaluateExpression = (expression: string, variables: Record<string, unknown>): boolean => {
    try {
        // Replace variable references
        let expr = expression;
        const varPattern = /\{\{(.+?)\}\}/g;
        let match;
        while ((match = varPattern.exec(expression)) !== null) {
            const varName = match[1].trim();
            const value = variables[varName];
            if (typeof value === 'string') {
                expr = expr.replace(match[0], `"${value}"`);
            } else if (value !== undefined && value !== null) {
                expr = expr.replace(match[0], String(value));
            } else {
                expr = expr.replace(match[0], 'undefined');
            }
        }

        // Handle comparison operators
        // ==, !=, >, <, >=, <=, contains, starts with, ends with
        const containsMatch = expr.match(/^"?(.+?)"?\s+contains\s+"?(.+?)"?$/i);
        if (containsMatch) {
            return String(containsMatch[1]).toLowerCase().includes(String(containsMatch[2]).toLowerCase());
        }

        const startsWithMatch = expr.match(/^"?(.+?)"?\s+starts\s+with\s+"?(.+?)"?$/i);
        if (startsWithMatch) {
            return String(startsWithMatch[1]).toLowerCase().startsWith(String(startsWithMatch[2]).toLowerCase());
        }

        const endsWithMatch = expr.match(/^"?(.+?)"?\s+ends\s+with\s+"?(.+?)"?$/i);
        if (endsWithMatch) {
            return String(endsWithMatch[1]).toLowerCase().endsWith(String(endsWithMatch[2]).toLowerCase());
        }

        // Handle AND/OR
        if (expr.includes(' AND ')) {
            const parts = expr.split(' AND ');
            return parts.every((p) => evaluateSimpleExpression(p.trim()));
        }

        if (expr.includes(' OR ')) {
            const parts = expr.split(' OR ');
            return parts.some((p) => evaluateSimpleExpression(p.trim()));
        }

        return evaluateSimpleExpression(expr);
    } catch (e) {
        console.error('[Condition] Expression evaluation error:', e);
        return false;
    }
};

const evaluateSimpleExpression = (expr: string): boolean => {
    // Try comparison operators: ==, !=, >=, <=, >, <
    const compMatch = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (compMatch) {
        const left = compMatch[1].trim().replace(/^["']|["']$/g, '');
        const op = compMatch[2];
        const right = compMatch[3].trim().replace(/^["']|["']$/g, '');

        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        const useNumeric = !isNaN(leftNum) && !isNaN(rightNum);

        switch (op) {
            case '==':
                return useNumeric ? leftNum === rightNum : left === right;
            case '!=':
                return useNumeric ? leftNum !== rightNum : left !== right;
            case '>':
                return useNumeric ? leftNum > rightNum : left > right;
            case '<':
                return useNumeric ? leftNum < rightNum : left < right;
            case '>=':
                return useNumeric ? leftNum >= rightNum : left >= right;
            case '<=':
                return useNumeric ? leftNum <= rightNum : left <= right;
        }
    }

    // Boolean-like check
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    return false;
};

const executeDelayNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IDelayNodeConfig;

    const seconds = config.delaySeconds || config.delayDuration || 5;

    let delayMs = seconds;
    if (config.delayUnit) {
        switch (config.delayUnit) {
            case 'SECONDS':
                delayMs = seconds * 1000;
                break;
            case 'MINUTES':
                delayMs = seconds * 60 * 1000;
                break;
            case 'HOURS':
                delayMs = seconds * 60 * 60 * 1000;
                break;
        }
    } else {
        delayMs = seconds * 1000; // default to seconds
    }

    const resumeAt = new Date(Date.now() + delayMs);

    // Find next node
    const nextEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
    const nextNodeId = config.nextNodeId || nextEdge?.targetNodeId;

    // Update session with resumeAt and next node
    await sessionService.updateSessionState(context.session._id, {
        status: 'PAUSED',
        resumeAt,
        currentNodeId: nextNodeId || node.nodeId,
    });

    return undefined; // Pause — cron will resume
};

const executeApiNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IApiNodeConfig;

    try {
        // Resolve variables in URL, headers, body
        const resolvedUrl = await resolveVariables(config.url, context.session._id, context.session.botId);

        const headers: Record<string, string> = {};
        if (config.headers) {
            for (const h of config.headers) {
                const resolvedValue = await resolveVariables(h.value, context.session._id, context.session.botId);
                headers[h.key] = resolvedValue;
            }
        }

        const params: Record<string, string> = {};
        if (config.queryParams) {
            for (const p of config.queryParams) {
                const resolvedValue = await resolveVariables(p.value, context.session._id, context.session.botId);
                params[p.key] = resolvedValue;
            }
        }

        let body: unknown;
        if (config.body) {
            const resolvedBody = await resolveVariables(config.body, context.session._id, context.session.botId);
            try {
                body = JSON.parse(resolvedBody);
            } catch {
                body = resolvedBody;
            }
        }

        const timeout = config.retry?.timeout ? config.retry.timeout * 1000 : 30000;
        const maxRetries = config.retry?.max || 3;

        let response;
        let retries = 0;
        while (retries < maxRetries) {
            try {
                response = await axios({
                    method: config.method.toLowerCase(),
                    url: resolvedUrl,
                    headers,
                    params,
                    data: body,
                    timeout,
                });
                break;
            } catch (err) {
                retries++;
                if (retries >= maxRetries) throw err;
                await new Promise((r) => setTimeout(r, (config.retry?.delay || 2) * 1000));
            }
        }

        // Store response in variables
        if (response) {
            if (config.storeEntireResponse && config.storeResponseIn) {
                await setSessionVariable(context.session._id, config.storeResponseIn, response.data, 'OBJECT');
            }

            if (config.responseMapping) {
                for (const mapping of config.responseMapping) {
                    const value = getJsonPathValue(response.data, mapping.jsonPath);
                    if (value !== undefined) {
                        const varType = typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'object' ? 'OBJECT' : 'STRING';
                        await setSessionVariable(context.session._id, mapping.variableName, value, varType);
                    }
                }
            }
        }

        return config.successNextNodeId;
    } catch (error) {
        console.error(`[API Node] Error:`, error);
        return config.failureNextNodeId;
    }
};

const getJsonPathValue = (obj: unknown, path: string): unknown => {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return current;
};

const executeAiNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as IAiNodeConfig;

    try {
        // Get user's OpenAI key
        const bot = await import('../models').then((m) => m.Bot.findById(context.session.botId));
        if (!bot) throw new Error('Bot not found');

        const openaiAccount = await OpenAIAccount.findOne({ userId: bot.userId });
        if (!openaiAccount) {
            throw new Error('OpenAI API key not configured. Please add your key in settings.');
        }

        const apiKey = decrypt(openaiAccount.apiKey);

        // Build messages array
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        if (config.systemPrompt) {
            const resolvedSystem = await resolveVariables(config.systemPrompt, context.session._id, context.session.botId);
            messages.push({ role: 'system', content: resolvedSystem });
        }

        // Include conversation history
        if (config.includeHistory) {
            const history = await sessionService.getConversationHistory(
                context.session._id,
                config.historyLength || 10
            );
            for (const msg of history) {
                messages.push(msg);
            }
        }

        // User prompt
        const userPromptText = config.userMessage || config.userPrompt || '';
        const resolvedUserPrompt = await resolveVariables(userPromptText, context.session._id, context.session.botId);
        messages.push({ role: 'user', content: resolvedUserPrompt });

        // Call OpenAI
        const result = await openaiService.chatCompletion(
            apiKey,
            config.model || 'gpt-3.5-turbo',
            messages,
            config.temperature || 0.7,
            config.maxTokens || 500
        );

        // Store response
        const responseVar = config.responseVariable || config.storeResponseIn || 'ai_response';
        await setSessionVariable(context.session._id, responseVar, result.content, 'STRING');

        // Send to user if configured
        if (config.sendToUser) {
            if (context.isSimulator) {
                context.simulatorResponses.push({ type: 'text', content: result.content });
            } else if (context.phoneNumberId && context.accessToken) {
                await whatsappService.sendTextMessage(
                    context.phoneNumberId,
                    context.accessToken,
                    context.session.userPhoneNumber,
                    result.content
                );
            }

            await Message.create({
                sessionId: context.session._id,
                sender: 'BOT',
                messageType: 'TEXT',
                messageContent: result.content,
                nodeId: node.nodeId,
                sentAt: new Date(),
            });
        }

        return config.successNextNodeId;
    } catch (error) {
        console.error(`[AI Node] Error:`, error);

        // Send fallback if available
        if (config.fallback) {
            const resolvedFallback = await resolveVariables(config.fallback, context.session._id, context.session.botId);
            if (context.isSimulator) {
                context.simulatorResponses.push({ type: 'text', content: resolvedFallback });
            } else if (context.phoneNumberId && context.accessToken) {
                await whatsappService.sendTextMessage(
                    context.phoneNumberId,
                    context.accessToken,
                    context.session.userPhoneNumber,
                    resolvedFallback
                );
            }
        }

        return config.failureNextNodeId;
    }
};

const executeLoopNode = async (context: IExecutionContext, node: IFlowNode): Promise<string | undefined> => {
    const config = node.config as ILoopNodeConfig;

    const iterationVar = config.currentIterationVariable || `__loop_${node.nodeId}_iter`;
    const vars = await getVariableMap(context.session._id, context.session.botId);
    const currentIteration = (vars[iterationVar] as number) || 0;

    if (config.loopType === 'COUNT_BASED') {
        const maxCount = config.iterationCount || config.maxIterations;
        if (currentIteration >= maxCount) {
            // Reset counter and exit
            await setSessionVariable(context.session._id, iterationVar, 0, 'NUMBER');
            return config.exitNextNodeId;
        }

        // Increment and go to loop body
        await setSessionVariable(context.session._id, iterationVar, currentIteration + 1, 'NUMBER');
        return config.loopBodyNextNodeId;
    } else {
        // CONDITION_BASED
        if (currentIteration >= config.maxIterations) {
            await setSessionVariable(context.session._id, iterationVar, 0, 'NUMBER');
            return config.exitNextNodeId;
        }

        // Evaluate exit condition
        if (config.exitCondition && evaluateExpression(config.exitCondition, vars)) {
            await setSessionVariable(context.session._id, iterationVar, 0, 'NUMBER');
            return config.exitNextNodeId;
        }

        // Continue loop
        await setSessionVariable(context.session._id, iterationVar, currentIteration + 1, 'NUMBER');
        return config.loopBodyNextNodeId;
    }
};

const executeEndNode = async (context: IExecutionContext, node: IFlowNode): Promise<void> => {
    const config = node.config as IEndNodeConfig;

    // Send final message if configured
    if (config.finalMessage) {
        const resolvedMsg = await resolveVariables(config.finalMessage, context.session._id, context.session.botId);

        if (context.isSimulator) {
            context.simulatorResponses.push({ type: 'text', content: resolvedMsg });
        } else if (context.phoneNumberId && context.accessToken) {
            await whatsappService.sendTextMessage(
                context.phoneNumberId,
                context.accessToken,
                context.session.userPhoneNumber,
                resolvedMsg
            );
        }

        await Message.create({
            sessionId: context.session._id,
            sender: 'BOT',
            messageType: 'TEXT',
            messageContent: resolvedMsg,
            nodeId: node.nodeId,
            sentAt: new Date(),
        });
    }

    // Update session status
    if (config.sessionAction === 'CLOSE_SESSION') {
        await sessionService.closeSession(context.session._id);
    } else {
        await sessionService.updateSessionState(context.session._id, {
            status: 'COMPLETED',
            currentNodeId: node.nodeId,
        });
    }

    // Log
    await ExecutionLog.create({
        sessionId: context.session._id,
        nodeId: node.nodeId,
        nodeType: 'END',
        executedAt: new Date(),
    });
};

// ============================================================
// GOTO SUBFLOW NODE
// ============================================================

async function executeGotoSubflowNode(context: IExecutionContext, node: IFlowNode): Promise<string | undefined> {
    const config = node.config as IGotoSubflowNodeConfig;

    if (!config.targetFlowId) {
        throw new Error('GOTO_SUBFLOW node has no target subflow configured');
    }

    // Find the next node after this GOTO_SUBFLOW node (the return point)
    const returnEdge = context.flowData.edges.find((e) => e.sourceNodeId === node.nodeId);
    const returnNodeId = returnEdge?.targetNodeId || '';

    // Find the target subflow's production version
    const targetFlow = await Flow.findById(config.targetFlowId);
    if (!targetFlow) {
        throw new Error(`Target subflow ${config.targetFlowId} not found`);
    }

    const subflowProdVersion = await FlowVersion.findOne({
        flowId: config.targetFlowId,
        isProduction: true,
    });

    if (!subflowProdVersion) {
        throw new Error(`No production version found for subflow "${targetFlow.name}"`);
    }

    // Push current flow context onto the call stack
    const currentCallStack = context.session.subflowCallStack || [];
    currentCallStack.push({
        flowVersionId: context.session.flowVersionId?.toString() || '',
        returnNodeId,
    });

    // Update session to point to the subflow's START node
    const subflowData = subflowProdVersion.flowData;
    const subflowStartNode = subflowData.nodes.find((n: { nodeType: string }) => n.nodeType === 'START');

    if (!subflowStartNode) {
        throw new Error(`Subflow "${targetFlow.name}" has no Start node`);
    }

    // Update session
    await Session.findByIdAndUpdate(context.session._id, {
        flowVersionId: subflowProdVersion._id,
        currentNodeId: subflowStartNode.nodeId,
        subflowCallStack: currentCallStack,
    });

    // Update the context in-memory
    context.session.flowVersionId = subflowProdVersion._id;
    context.session.currentNodeId = subflowStartNode.nodeId;
    context.session.subflowCallStack = currentCallStack;
    context.flowData = subflowData;

    // Don't return a nextNodeId — instead execute from the subflow's start node directly
    await executeNode(context);
    return undefined; // Execution continues inside executeNode
};

// ============================================================
// SUBFLOW RETURN HANDLER
// ============================================================

async function handleSubflowReturn(context: IExecutionContext): Promise<void> {
    const callStack = context.session.subflowCallStack || [];
    if (callStack.length === 0) {
        // No subflow to return from — flow execution is truly complete
        return;
    }

    // Pop the top entry from the call stack
    const returnEntry = callStack.pop()!;

    // Load the parent flow version
    const parentFlowVersion = await FlowVersion.findById(returnEntry.flowVersionId);
    if (!parentFlowVersion) {
        console.error(`[Execution] Parent flow version ${returnEntry.flowVersionId} not found during subflow return`);
        await sessionService.updateSessionState(context.session._id, { status: 'FAILED' });
        return;
    }

    // Update session to return to the parent flow
    await Session.findByIdAndUpdate(context.session._id, {
        flowVersionId: parentFlowVersion._id,
        currentNodeId: returnEntry.returnNodeId,
        subflowCallStack: callStack,
    });

    // Update context in-memory
    context.session.flowVersionId = parentFlowVersion._id;
    context.session.currentNodeId = returnEntry.returnNodeId;
    context.session.subflowCallStack = callStack;
    context.flowData = parentFlowVersion.flowData;

    // Continue execution from the return node if it exists
    if (returnEntry.returnNodeId) {
        await executeNode(context);
    }
};
