import axios, { AxiosError } from 'axios';
import { AIApiLog } from '../models';
import { Types } from 'mongoose';

// ─── Provider base URL presets ──────────────────────────────────
export const PROVIDER_PRESETS: Record<string, string> = {
    OPENAI: 'https://api.openai.com/v1',
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta/openai',
    GROQ: 'https://api.groq.com/openai/v1',
    MISTRAL: 'https://api.mistral.ai/v1',
    OPENROUTER: 'https://openrouter.ai/api/v1',
};

// ─── Interfaces ─────────────────────────────────────────────────
export interface IChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface IChatCompletionParams {
    baseUrl: string;
    apiKey: string;
    model: string;
    messages: IChatMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    seed?: number;
    responseFormat?: 'text' | 'json_object';
    timeout?: number; // seconds
}

export interface IChatCompletionResult {
    success: boolean;
    content: string;
    rawResponse: Record<string, unknown>;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    error?: string;
    errorCode?: string;
    responseTimeMs: number;
}

export interface IAILogContext {
    userId: Types.ObjectId;
    botId: Types.ObjectId;
    sessionId?: Types.ObjectId;
    nodeId: string;
    nodeLabel: string;
    aiProviderId?: Types.ObjectId;
    providerName: string;
    provider: string;
}

// ─── Chat Completion ────────────────────────────────────────────
export const chatCompletion = async (
    params: IChatCompletionParams,
    logContext: IAILogContext
): Promise<IChatCompletionResult> => {
    const startTime = Date.now();
    const timeoutMs = (params.timeout || 30) * 1000;

    try {
        const url = `${params.baseUrl.replace(/\/+$/, '')}/chat/completions`;

        const requestBody: Record<string, unknown> = {
            model: params.model,
            messages: params.messages,
        };

        if (params.temperature !== undefined) requestBody.temperature = params.temperature;
        if (params.maxTokens !== undefined) requestBody.max_tokens = params.maxTokens;
        if (params.topP !== undefined) requestBody.top_p = params.topP;
        if (params.frequencyPenalty !== undefined) requestBody.frequency_penalty = params.frequencyPenalty;
        if (params.presencePenalty !== undefined) requestBody.presence_penalty = params.presencePenalty;
        if (params.stop && params.stop.length > 0) requestBody.stop = params.stop;
        if (params.seed !== undefined) requestBody.seed = params.seed;
        if (params.responseFormat === 'json_object') {
            requestBody.response_format = { type: 'json_object' };
        }


        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${params.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: timeoutMs,
        });

        const responseTimeMs = Date.now() - startTime;
        const data = response.data;

        const content = data?.choices?.[0]?.message?.content || '';
        const usage = {
            promptTokens: data?.usage?.prompt_tokens || 0,
            completionTokens: data?.usage?.completion_tokens || 0,
            totalTokens: data?.usage?.total_tokens || 0,
        };

        // Log success
        await AIApiLog.create({
            ...logContext,
            modelName: params.model,
            status: 'SUCCESS',
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            responseTimeMs,
        });


        return {
            success: true,
            content,
            rawResponse: data,
            usage,
            responseTimeMs,
        };
    } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        let errorMessage = 'Unknown AI API error';
        let errorCode: string | undefined;

        if (error instanceof AxiosError) {
            errorCode = String(error.response?.status || error.code || 'UNKNOWN');
            const apiError = error.response?.data?.error;
            if (apiError) {
                errorMessage = typeof apiError === 'string'
                    ? apiError
                    : apiError.message || JSON.stringify(apiError);
            } else {
                errorMessage = error.message;
            }
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        // Log error
        await AIApiLog.create({
            ...logContext,
            modelName: params.model,
            status: 'ERROR',
            errorMessage,
            errorCode: errorCode || null,
            responseTimeMs,
        });

        console.error(`[AI Service] ❌ Error: ${errorCode} - ${errorMessage} (${responseTimeMs}ms)`);

        return {
            success: false,
            content: '',
            rawResponse: {},
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            error: errorMessage,
            errorCode,
            responseTimeMs,
        };
    }
};

// ─── Chat Completion with Retry ─────────────────────────────────
export const chatCompletionWithRetry = async (
    params: IChatCompletionParams,
    logContext: IAILogContext,
    retryConfig?: { max: number; delay: number }
): Promise<IChatCompletionResult> => {
    const maxRetries = retryConfig?.max || 0;
    const retryDelay = retryConfig?.delay || 1000;

    let lastResult: IChatCompletionResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }

        lastResult = await chatCompletion(params, logContext);

        if (lastResult.success) {
            return lastResult;
        }

        // Don't retry on client errors (4xx) — only on server/timeout
        if (lastResult.errorCode && parseInt(lastResult.errorCode) >= 400 && parseInt(lastResult.errorCode) < 500) {
            return lastResult;
        }
    }

    return lastResult!;
};

// ─── Validate API Key ───────────────────────────────────────────
export const validateApiKey = async (baseUrl: string, apiKey: string): Promise<boolean> => {
    try {
        const url = `${baseUrl.replace(/\/+$/, '')}/models`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 10000,
        });
        return response.status === 200;
    } catch {
        return false;
    }
};
