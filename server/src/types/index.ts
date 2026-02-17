import { Document, Types } from 'mongoose';

// ============================================================
// TYPE ALIASES
// ============================================================

export type TUserRole = 'ADMIN' | 'USER';
export type TSessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CLOSED' | 'FAILED';
export type TNodeType = 'START' | 'MESSAGE' | 'BUTTON' | 'INPUT' | 'CONDITION' | 'DELAY' | 'API' | 'AI' | 'LOOP' | 'END' | 'GOTO_SUBFLOW';
export type TVariableType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';
export type TMessageSender = 'USER' | 'BOT';
export type TMessageType = 'TEXT' | 'BUTTON' | 'IMAGE' | 'DOCUMENT';
export type TInputType = 'TEXT' | 'NUMBER' | 'EMAIL' | 'PHONE' | 'CUSTOM_REGEX';
export type THttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type TLoopType = 'COUNT_BASED' | 'CONDITION_BASED';
export type TEndType = 'NORMAL' | 'ERROR';
export type TSessionAction = 'KEEP_ACTIVE' | 'CLOSE_SESSION';
export type TConditionType = 'KEYWORD_MATCH' | 'VARIABLE_COMPARISON' | 'LOGICAL_EXPRESSION';

// ============================================================
// DOCUMENT INTERFACES (Mongoose)
// ============================================================

export interface IUser extends Document {
    _id: Types.ObjectId;
    email: string;
    passwordHash: string;
    role: TUserRole;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOpenAIAccount extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    apiKey: string; // Encrypted
    createdAt: Date;
    updatedAt: Date;
}

export interface IBot extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    name: string;
    description?: string;
    activeFlowId?: Types.ObjectId;
    defaultFallbackMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IWhatsAppAccount extends Document {
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    phoneNumberId: string;
    accessToken: string; // Encrypted
    phoneNumber: string;
    verifyToken: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IFlow extends Document {
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    name: string;
    description?: string;
    isMainFlow: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IFlowVersion extends Document {
    _id: Types.ObjectId;
    flowId: Types.ObjectId;
    versionNumber: number;
    flowData: IFlowData;
    isDraft: boolean;
    isProduction: boolean;
    deployedAt?: Date;
    deployedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISubflowCallStackEntry {
    flowVersionId: string;
    returnNodeId: string;
}

export interface ISession extends Document {
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    flowVersionId?: Types.ObjectId;
    userPhoneNumber: string;
    currentNodeId?: string;
    status: TSessionStatus;
    subflowCallStack: ISubflowCallStackEntry[];
    resumeAt?: Date;
    closedAt?: Date;
    isTest: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISessionVariable extends Document {
    _id: Types.ObjectId;
    sessionId: Types.ObjectId;
    variableName: string;
    variableValue: unknown;
    variableType: TVariableType;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMessage extends Document {
    _id: Types.ObjectId;
    sessionId: Types.ObjectId;
    sender: TMessageSender;
    messageType: TMessageType;
    messageContent?: string;
    nodeId?: string;
    sentAt: Date;
}

export interface IBotVariable extends Document {
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    variableName: string;
    variableValue: unknown;
    variableType: TVariableType;
    createdAt: Date;
    updatedAt: Date;
}

export interface IExecutionLog extends Document {
    _id: Types.ObjectId;
    sessionId: Types.ObjectId;
    nodeId: string;
    nodeType: TNodeType;
    executionDuration?: number;
    inputVariables?: Record<string, unknown>;
    outputVariables?: Record<string, unknown>;
    nextNodeId?: string;
    error?: string;
    executedAt: Date;
}

// ============================================================
// FLOW DATA INTERFACES
// ============================================================

export interface IFlowData {
    nodes: IFlowNode[];
    edges: IFlowEdge[];
    variables?: {
        bot?: string[];
        session?: string[];
    };
}

export interface IFlowNode {
    nodeId: string;
    nodeType: TNodeType;
    position: { x: number; y: number };
    label?: string;
    description?: string;
    config: INodeConfig;
}

export interface IFlowEdge {
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string;
    targetHandle?: string;
}

// ============================================================
// NODE CONFIG INTERFACES
// ============================================================

export type INodeConfig =
    | IStartNodeConfig
    | IMessageNodeConfig
    | IButtonNodeConfig
    | IInputNodeConfig
    | IConditionNodeConfig
    | IDelayNodeConfig
    | IApiNodeConfig
    | IAiNodeConfig
    | ILoopNodeConfig
    | IEndNodeConfig
    | IGotoSubflowNodeConfig;

export interface IStartNodeConfig {
    nextNodeId?: string;
}

export interface IMessageNodeConfig {
    text: string;
    messageContent?: string; // legacy alias
    nextNodeId?: string;
}

export interface IButtonConfig {
    buttonId: string;
    label: string;
    nextNodeId?: string;
    storeIn?: string;
}

export interface IButtonNodeConfig {
    messageText?: string;
    buttons: IButtonConfig[];
    fallback?: {
        message?: string;
        nextNodeId?: string;
    };
}

export interface IInputNodeConfig {
    promptText: string;
    promptMessage?: string; // legacy alias
    inputType: TInputType;
    validation?: {
        minLength?: number;
        maxLength?: number;
        regexPattern?: string;
    };
    variableName: string;
    retryConfig?: {
        maxRetries: number;
        retryMessage?: string;
        failureNextNodeId?: string;
    };
    successNextNodeId?: string;
}

export interface IConditionBranch {
    label: string;
    expression: string;
    nextNodeId?: string;
}

export interface IConditionNodeConfig {
    conditionType?: TConditionType;
    leftOperand?: string;
    operator?: string;
    rightOperand?: string;
    branches?: IConditionBranch[];
    defaultBranch?: {
        nextNodeId?: string;
    };
}

export interface IDelayNodeConfig {
    delaySeconds: number;
    delayDuration?: number; // legacy alias
    delayUnit?: 'SECONDS' | 'MINUTES' | 'HOURS';
    nextNodeId?: string;
}

export interface IApiHeaderParam {
    key: string;
    value: string;
}

export interface IApiResponseMapping {
    jsonPath: string;
    variableName: string;
}

export interface IApiNodeConfig {
    method: THttpMethod;
    url: string;
    headers?: IApiHeaderParam[];
    queryParams?: IApiHeaderParam[];
    body?: string;
    responseMapping?: IApiResponseMapping[];
    storeEntireResponse?: boolean;
    storeResponseIn?: string;
    retry?: {
        max: number;
        delay: number;
        timeout: number;
    };
    successNextNodeId?: string;
    failureNextNodeId?: string;
}

export interface IAiNodeConfig {
    model: string;
    temperature?: number;
    systemPrompt?: string;
    userMessage: string;
    userPrompt?: string; // legacy alias
    includeHistory?: boolean;
    historyLength?: number;
    maxTokens?: number;
    responseVariable: string;
    storeResponseIn?: string; // legacy alias
    sendToUser?: boolean;
    fallback?: string;
    successNextNodeId?: string;
    failureNextNodeId?: string;
}

export interface ILoopNodeConfig {
    loopType: TLoopType;
    iterationCount?: number;
    currentIterationVariable?: string;
    exitCondition?: string;
    maxIterations: number;
    loopBodyNextNodeId?: string;
    exitNextNodeId?: string;
}

export interface IEndNodeConfig {
    endType: TEndType;
    finalMessage?: string;
    sessionAction: TSessionAction;
}

export interface IGotoSubflowNodeConfig {
    targetFlowId?: string;
    nextNodeId?: string;
}

// ============================================================
// API REQUEST / RESPONSE TYPES
// ============================================================

export interface IAuthLoginRequest {
    email: string;
    password: string;
}

export interface IAuthRegisterRequest {
    email: string;
    password: string;
}

export interface IAuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        role: TUserRole;
    };
}

export interface IApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface IValidationResult {
    isValid: boolean;
    errors: IValidationError[];
    warnings: IValidationWarning[];
}

export interface IValidationError {
    nodeId?: string;
    field?: string;
    message: string;
}

export interface IValidationWarning {
    nodeId?: string;
    field?: string;
    message: string;
}

// JWT Payload
export interface IJwtPayload {
    userId: string;
    email: string;
    role: TUserRole;
}

// Express Request extension
declare global {
    namespace Express {
        interface Request {
            user?: IJwtPayload;
        }
    }
}
