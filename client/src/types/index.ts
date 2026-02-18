// ============================================================
// TYPE ALIASES
// ============================================================

export type TUserRole = 'ADMIN' | 'USER';
export type TSessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CLOSED' | 'FAILED';
export type TNodeType = 'START' | 'MESSAGE' | 'BUTTON' | 'INPUT' | 'CONDITION' | 'DELAY' | 'API' | 'AI' | 'LOOP' | 'END' | 'GOTO_SUBFLOW';
export type TVariableType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';

// ============================================================
// API INTERFACES
// ============================================================

export interface IUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: TUserRole;
    createdAt?: string;
}

export interface IAuthResponse {
    token: string;
    user: IUser;
}

export interface IBot {
    _id: string;
    userId: string;
    name: string;
    description?: string;
    activeFlowId?: string;
    defaultFallbackMessage?: string;
    isWhatsAppConnected?: boolean;
    phoneNumber?: string;
    flowCount?: number;
    activeSessionCount?: number;
    whatsapp?: {
        phoneNumberId: string;
        phoneNumber: string;
        verifyToken: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface IFlow {
    _id: string;
    botId: string;
    name: string;
    description?: string;
    isMainFlow?: boolean;
    draftVersion?: number;
    productionVersion?: number;
    isDeployed?: boolean;
    lastUpdated?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IFlowVersion {
    _id: string;
    flowId: string;
    versionNumber: number;
    flowData: IFlowData;
    isDraft: boolean;
    isProduction: boolean;
    deployedAt?: string;
    createdAt: string;
    updatedAt: string;
}

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
    config: Record<string, unknown>;
}

export interface IFlowEdge {
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface IValidationResult {
    isValid: boolean;
    errors: Array<{ nodeId?: string; field?: string; message: string }>;
    warnings: Array<{ nodeId?: string; message: string }>;
}

export interface ISimulatorResponse {
    type: string;
    content: string;
    buttons?: Array<{ id: string; label: string }>;
}

export interface IDashboardStats {
    totalBots: number;
    totalFlows: number;
    activeSessions: number;
    messagesSent24h: number;
    completionRate: number;
    totalSessions: number;
}

export interface IBotVariable {
    _id: string;
    botId: string;
    variableName: string;
    variableValue: unknown;
    variableType: TVariableType;
}

export interface IApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
