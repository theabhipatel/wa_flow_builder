import { SessionVariable, BotVariable } from '../models';
import { Types } from 'mongoose';

/**
 * Resolves template variables in a string.
 * Supports: {{variableName}}, {{nested.path}}, {{arr[0].field}}, {{var || "fallback"}}
 */
export const resolveVariables = async (
    template: string,
    sessionId: Types.ObjectId,
    botId: Types.ObjectId
): Promise<string> => {
    if (!template) return template;

    const variablePattern = /\{\{(.+?)\}\}/g;
    const matches = template.match(variablePattern);

    if (!matches) return template;

    // Load all session and bot variables — use .lean() for plain JS objects
    const [sessionVars, botVars] = await Promise.all([
        SessionVariable.find({ sessionId }).lean(),
        BotVariable.find({ botId }).lean(),
    ]);

    const variableMap: Record<string, unknown> = {};

    // Bot variables first (lower priority)
    for (const bv of botVars) {
        variableMap[bv.variableName] = parseStoredValue(bv.variableValue);
    }

    // Session variables override (higher priority)
    for (const sv of sessionVars) {
        variableMap[sv.variableName] = parseStoredValue(sv.variableValue);
    }



    let resolved = template;
    for (const match of matches) {
        const inner = match.slice(2, -2).trim(); // Remove {{ and }}

        // Check for fallback: {{var || "default"}}
        let varPath = inner;
        let fallback: string | undefined;
        if (inner.includes('||')) {
            const parts = inner.split('||').map((p) => p.trim());
            varPath = parts[0];
            fallback = parts[1].replace(/^["']|["']$/g, ''); // Remove quotes
        }

        const value = resolveNestedValue(variableMap, varPath);

        if (value !== undefined && value !== null) {
            resolved = resolved.replace(match, stringifyForTemplate(value));
        } else if (fallback !== undefined) {
            resolved = resolved.replace(match, fallback);
        } else {
            // Leave as-is if no value and no fallback
            // resolved = resolved.replace(match, '');
        }
    }

    return resolved;
};

/**
 * Parse a stored value — if it's a JSON string, parse it into an object/array
 */
const parseStoredValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return value;
            }
        }
    }
    return value;
};

/**
 * Convert a value to string for template replacement
 */
const stringifyForTemplate = (value: unknown): string => {
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    return String(value);
};

/**
 * Resolve a nested path like "user.profile.email" or "orders[0].id"
 */
const resolveNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    // Handle array access: orders[0].id → orders.0.id
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');

    let current: unknown = obj;
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

/**
 * Get all variables for a session as a flat map
 */
export const getVariableMap = async (
    sessionId: Types.ObjectId,
    botId: Types.ObjectId
): Promise<Record<string, unknown>> => {
    const [sessionVars, botVars] = await Promise.all([
        SessionVariable.find({ sessionId }).lean(),
        BotVariable.find({ botId }).lean(),
    ]);

    const map: Record<string, unknown> = {};

    for (const bv of botVars) {
        map[bv.variableName] = parseStoredValue(bv.variableValue);
    }

    for (const sv of sessionVars) {
        map[sv.variableName] = parseStoredValue(sv.variableValue);
    }

    return map;
};

/**
 * Set a session variable (upsert)
 */
export const setSessionVariable = async (
    sessionId: Types.ObjectId,
    variableName: string,
    variableValue: unknown,
    variableType: string = 'STRING'
): Promise<void> => {
    await SessionVariable.findOneAndUpdate(
        { sessionId, variableName },
        {
            variableValue,
            variableType,
            updatedAt: new Date(),
        },
        { upsert: true, new: true }
    );
};
