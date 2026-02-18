import { useState, useEffect } from 'react';
import { type Node } from '@xyflow/react';
import { X, Trash2, Plus, Lock, Link, FileText, Package, Timer, Download, AlertTriangle, Lightbulb, SlidersHorizontal, BarChart3 } from 'lucide-react';
import api from '../../lib/api';
import { useParams } from 'react-router-dom';

interface Props {
    node: Node;
    onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
    onLabelChange: (nodeId: string, label: string) => void;
    onDelete: (nodeId: string) => void;
    onClose: () => void;
}

interface ButtonItem {
    buttonId: string;
    label: string;
}

interface SubflowOption {
    _id: string;
    name: string;
}

const MAX_BUTTONS = 3;
const MAX_BODY_TEXT_CHARS = 1024;
const MAX_BUTTON_LABEL_CHARS = 20;

export default function NodeSettingsPanel({ node, onConfigChange, onLabelChange, onDelete, onClose }: Props) {
    const { botId, flowId } = useParams();
    const data = node.data as { nodeType: string; label: string; config: Record<string, unknown> };
    const nodeType = data.nodeType;
    const config = data.config || {};

    const [subflows, setSubflows] = useState<SubflowOption[]>([]);
    const [aiProviders, setAiProviders] = useState<Array<{ _id: string; name: string; provider: string; defaultModel: string; isActive: boolean }>>([]);

    // Fetch subflows for GOTO_SUBFLOW node
    useEffect(() => {
        if (nodeType === 'GOTO_SUBFLOW' && botId) {
            const fetchSubflows = async () => {
                try {
                    const res = await api.get(`/bots/${botId}/flows`);
                    if (res.data.success) {
                        // Filter to subflows only (not main flow, not current flow)
                        const allFlows = res.data.data as Array<{ _id: string; name: string; isMainFlow?: boolean }>;
                        setSubflows(
                            allFlows
                                .filter((f) => !f.isMainFlow && f._id !== flowId)
                                .map((f) => ({ _id: f._id, name: f.name }))
                        );
                    }
                } catch (err) {
                    console.error('Failed to fetch subflows:', err);
                }
            };
            fetchSubflows();
        }
    }, [nodeType, botId, flowId]);

    // Fetch AI providers for AI node
    useEffect(() => {
        if (nodeType === 'AI') {
            const fetchProviders = async () => {
                try {
                    const res = await api.get('/ai-providers');
                    if (res.data.success) {
                        setAiProviders(res.data.data);
                    }
                } catch (err) {
                    console.error('Failed to fetch AI providers:', err);
                }
            };
            fetchProviders();
        }
    }, [nodeType]);

    const updateConfig = (key: string, value: unknown) => {
        onConfigChange(node.id, { [key]: value });
    };

    // ---- Button helpers ----
    const buttons: ButtonItem[] = (config.buttons as ButtonItem[]) || [];

    const setButtons = (newButtons: ButtonItem[]) => {
        onConfigChange(node.id, { buttons: newButtons });
    };

    const addButton = () => {
        if (buttons.length >= MAX_BUTTONS) return;
        const newBtn: ButtonItem = {
            buttonId: `btn_${Date.now()}`,
            label: '',
        };
        setButtons([...buttons, newBtn]);
    };

    const removeButton = (index: number) => {
        if (buttons.length <= 1) return;
        setButtons(buttons.filter((_, i) => i !== index));
    };

    const updateButtonLabel = (index: number, label: string) => {
        if (label.length > MAX_BUTTON_LABEL_CHARS) return;
        const updated = [...buttons];
        updated[index] = { ...updated[index], label };
        setButtons(updated);
    };

    // Auto-add a default button if BUTTON node has no buttons
    useEffect(() => {
        if (nodeType === 'BUTTON' && (!config.buttons || (config.buttons as ButtonItem[]).length === 0)) {
            onConfigChange(node.id, {
                buttons: [{ buttonId: `btn_${Date.now()}`, label: 'Button 1' }],
            });
        }
    }, [nodeType]);

    const messageText = (config.messageText as string) || '';
    const bodyTextCharsLeft = MAX_BODY_TEXT_CHARS - messageText.length;

    return (
        <div className="w-80 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-sm">Node Settings</h3>
                    <span className="text-xs text-surface-500 uppercase">{nodeType === 'GOTO_SUBFLOW' ? 'GO TO SUBFLOW' : nodeType}</span>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Label */}
                <div>
                    <label className="input-label">Label</label>
                    <input
                        value={data.label || ''}
                        onChange={(e) => onLabelChange(node.id, e.target.value)}
                        className="input-field"
                        placeholder="Node label"
                    />
                </div>

                {/* ======================== START ======================== */}
                {nodeType === 'START' && (
                    <div className="text-xs text-surface-500 italic">
                        This is the entry point of the flow. It is automatically added and cannot be removed.
                    </div>
                )}

                {/* ======================== MESSAGE ======================== */}
                {nodeType === 'MESSAGE' && (
                    <div>
                        <label className="input-label">Message Text</label>
                        <textarea
                            value={(config.text as string) || ''}
                            onChange={(e) => updateConfig('text', e.target.value)}
                            className="input-field"
                            rows={4}
                            placeholder="Hello {{name}}! How can I help?"
                        />
                        <p className="text-xs text-surface-500 mt-1">Use {'{{variable}}'} for dynamic content</p>
                    </div>
                )}

                {/* ======================== BUTTON ======================== */}
                {nodeType === 'BUTTON' && (
                    <>
                        <div>
                            <label className="input-label">Message Text</label>
                            <textarea
                                value={messageText}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_BODY_TEXT_CHARS) {
                                        updateConfig('messageText', e.target.value);
                                    }
                                }}
                                className="input-field"
                                rows={3}
                                placeholder="Please select an option:"
                            />
                            <p className={`text-xs mt-1 ${bodyTextCharsLeft < 50 ? 'text-red-500' : 'text-surface-500'}`}>
                                {bodyTextCharsLeft} / {MAX_BODY_TEXT_CHARS} characters remaining
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="input-label !mb-0">Buttons</label>
                                <span className="text-xs text-surface-500">{buttons.length} / {MAX_BUTTONS}</span>
                            </div>

                            <div className="space-y-2">
                                {buttons.map((btn, idx) => (
                                    <div key={btn.buttonId} className="flex items-center gap-2">
                                        <input
                                            value={btn.label}
                                            onChange={(e) => updateButtonLabel(idx, e.target.value)}
                                            className="input-field flex-1 !py-2 text-sm"
                                            placeholder={`Button ${idx + 1} label`}
                                            maxLength={MAX_BUTTON_LABEL_CHARS}
                                        />
                                        <span className="text-[10px] text-surface-400 w-8 text-right whitespace-nowrap">
                                            {btn.label.length}/{MAX_BUTTON_LABEL_CHARS}
                                        </span>
                                        {buttons.length > 1 && (
                                            <button
                                                onClick={() => removeButton(idx)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors flex-shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addButton}
                                disabled={buttons.length >= MAX_BUTTONS}
                                className={`mt-2 w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-dashed transition-colors ${buttons.length >= MAX_BUTTONS
                                    ? 'border-surface-200 dark:border-surface-700 text-surface-400 cursor-not-allowed opacity-50'
                                    : 'border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                                    }`}
                            >
                                <Plus className="w-3 h-3" />
                                Add Button {buttons.length >= MAX_BUTTONS && '(Max 3)'}
                            </button>
                        </div>
                    </>
                )}

                {/* ======================== INPUT ======================== */}
                {nodeType === 'INPUT' && (
                    <>
                        <div>
                            <label className="input-label">Prompt Message</label>
                            <textarea
                                value={(config.promptText as string) || ''}
                                onChange={(e) => updateConfig('promptText', e.target.value)}
                                className="input-field"
                                rows={3}
                                placeholder="Please enter your name:"
                            />
                        </div>
                        <div>
                            <label className="input-label">Save to Variable</label>
                            <input
                                value={(config.variableName as string) || ''}
                                onChange={(e) => updateConfig('variableName', e.target.value)}
                                className="input-field"
                                placeholder="user_name"
                            />
                        </div>
                        <div>
                            <label className="input-label">Validation (regex, optional)</label>
                            <input
                                value={(config.validation as string) || ''}
                                onChange={(e) => updateConfig('validation', e.target.value)}
                                className="input-field font-mono text-xs"
                                placeholder="^[a-zA-Z ]+$"
                            />
                        </div>
                    </>
                )}

                {/* ======================== CONDITION ======================== */}
                {nodeType === 'CONDITION' && (
                    <>
                        <div>
                            <label className="input-label">Left Operand</label>
                            <input
                                value={(config.leftOperand as string) || ''}
                                onChange={(e) => updateConfig('leftOperand', e.target.value)}
                                className="input-field"
                                placeholder="{{user_choice}}"
                            />
                        </div>
                        <div>
                            <label className="input-label">Operator</label>
                            <select
                                value={(config.operator as string) || 'equals'}
                                onChange={(e) => updateConfig('operator', e.target.value)}
                                className="input-field"
                            >
                                <option value="equals">Equals</option>
                                <option value="not_equals">Not Equals</option>
                                <option value="contains">Contains</option>
                                <option value="greater_than">Greater Than</option>
                                <option value="less_than">Less Than</option>
                                <option value="regex_match">Regex Match</option>
                            </select>
                        </div>
                        <div>
                            <label className="input-label">Right Operand</label>
                            <input
                                value={(config.rightOperand as string) || ''}
                                onChange={(e) => updateConfig('rightOperand', e.target.value)}
                                className="input-field"
                                placeholder="yes"
                            />
                        </div>
                    </>
                )}

                {/* ======================== DELAY ======================== */}
                {nodeType === 'DELAY' && (
                    <div>
                        <label className="input-label">Delay (seconds)</label>
                        <input
                            type="number"
                            value={(config.delaySeconds as number) || 5}
                            onChange={(e) => updateConfig('delaySeconds', parseInt(e.target.value))}
                            className="input-field"
                            min={1}
                            max={86400}
                        />
                    </div>
                )}

                {/* ======================== API ======================== */}
                {nodeType === 'API' && (
                    <>
                        {/* ─── Method ─── */}
                        <div>
                            <label className="input-label">Method</label>
                            <select
                                value={(config.method as string) || 'GET'}
                                onChange={(e) => updateConfig('method', e.target.value)}
                                className="input-field"
                            >
                                <option>GET</option>
                                <option>POST</option>
                                <option>PUT</option>
                                <option>PATCH</option>
                                <option>DELETE</option>
                            </select>
                        </div>

                        {/* ─── URL ─── */}
                        <div>
                            <label className="input-label">URL</label>
                            <input
                                value={(config.url as string) || ''}
                                onChange={(e) => updateConfig('url', e.target.value)}
                                className="input-field font-mono text-xs"
                                placeholder="https://api.example.com/users/{{user_id}}"
                            />
                            <p className="text-xs text-surface-500 mt-1">Supports {'{{variable}}'} interpolation</p>
                        </div>

                        {/* ─── Authentication ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-auth-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Authentication</span>
                                <span className="text-[10px] text-surface-400">{(config.authType as string) || 'None'}</span>
                            </button>
                            <div id="api-auth-section" className="px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Auth Type</label>
                                    <select
                                        value={(config.authType as string) || 'NONE'}
                                        onChange={(e) => updateConfig('authType', e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="NONE">None</option>
                                        <option value="BEARER">Bearer Token</option>
                                        <option value="API_KEY">API Key</option>
                                        <option value="BASIC_AUTH">Basic Auth</option>
                                        <option value="CUSTOM_HEADER">Custom Header</option>
                                    </select>
                                </div>

                                {/* Bearer Token */}
                                {(config.authType as string) === 'BEARER' && (
                                    <div>
                                        <label className="input-label">Token</label>
                                        <input
                                            value={((config.authConfig as Record<string, string>)?.bearerToken) || ''}
                                            onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), bearerToken: e.target.value })}
                                            className="input-field font-mono text-xs"
                                            placeholder="{{auth_token}} or paste token"
                                        />
                                    </div>
                                )}

                                {/* API Key */}
                                {(config.authType as string) === 'API_KEY' && (
                                    <>
                                        <div>
                                            <label className="input-label">Key Name</label>
                                            <input
                                                value={((config.authConfig as Record<string, string>)?.apiKeyName) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), apiKeyName: e.target.value })}
                                                className="input-field text-xs"
                                                placeholder="X-API-Key"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Key Value</label>
                                            <input
                                                value={((config.authConfig as Record<string, string>)?.apiKeyValue) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), apiKeyValue: e.target.value })}
                                                className="input-field font-mono text-xs"
                                                placeholder="{{api_key}} or paste key"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Send In</label>
                                            <select
                                                value={((config.authConfig as Record<string, string>)?.apiKeyLocation) || 'HEADER'}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), apiKeyLocation: e.target.value })}
                                                className="input-field"
                                            >
                                                <option value="HEADER">Header</option>
                                                <option value="QUERY">Query Parameter</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* Basic Auth */}
                                {(config.authType as string) === 'BASIC_AUTH' && (
                                    <>
                                        <div>
                                            <label className="input-label">Username</label>
                                            <input
                                                value={((config.authConfig as Record<string, string>)?.basicUsername) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), basicUsername: e.target.value })}
                                                className="input-field text-xs"
                                                placeholder="{{username}} or enter username"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Password</label>
                                            <input
                                                type="password"
                                                value={((config.authConfig as Record<string, string>)?.basicPassword) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), basicPassword: e.target.value })}
                                                className="input-field text-xs"
                                                placeholder="{{password}} or enter password"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Custom Header */}
                                {(config.authType as string) === 'CUSTOM_HEADER' && (
                                    <>
                                        <div>
                                            <label className="input-label">Header Name</label>
                                            <input
                                                value={((config.authConfig as Record<string, string>)?.customAuthHeader) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), customAuthHeader: e.target.value })}
                                                className="input-field text-xs"
                                                placeholder="X-Custom-Auth"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Header Value</label>
                                            <input
                                                value={((config.authConfig as Record<string, string>)?.customAuthValue) || ''}
                                                onChange={(e) => updateConfig('authConfig', { ...(config.authConfig as object || {}), customAuthValue: e.target.value })}
                                                className="input-field font-mono text-xs"
                                                placeholder="{{custom_token}}"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ─── Query Parameters ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-params-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" /> Query Parameters</span>
                                <span className="text-[10px] text-surface-400">{((config.queryParams as Array<{ key: string; value: string }>) || []).length} params</span>
                            </button>
                            <div id="api-params-section" className="px-3 pb-3 space-y-2">
                                {((config.queryParams as Array<{ key: string; value: string }>) || []).map((param: { key: string; value: string }, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <input
                                            value={param.key}
                                            onChange={(e) => {
                                                const params = [...((config.queryParams as Array<{ key: string; value: string }>) || [])];
                                                params[idx] = { ...params[idx], key: e.target.value };
                                                updateConfig('queryParams', params);
                                            }}
                                            className="input-field flex-1 !py-1.5 text-xs"
                                            placeholder="key"
                                        />
                                        <input
                                            value={param.value}
                                            onChange={(e) => {
                                                const params = [...((config.queryParams as Array<{ key: string; value: string }>) || [])];
                                                params[idx] = { ...params[idx], value: e.target.value };
                                                updateConfig('queryParams', params);
                                            }}
                                            className="input-field flex-1 !py-1.5 text-xs"
                                            placeholder="value"
                                        />
                                        <button
                                            onClick={() => {
                                                const params = ((config.queryParams as Array<{ key: string; value: string }>) || []).filter((_: unknown, i: number) => i !== idx);
                                                updateConfig('queryParams', params);
                                            }}
                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors flex-shrink-0"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const params = [...((config.queryParams as Array<{ key: string; value: string }>) || []), { key: '', value: '' }];
                                        updateConfig('queryParams', params);
                                    }}
                                    className="w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-dashed border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Parameter
                                </button>
                            </div>
                        </div>

                        {/* ─── Custom Headers ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-headers-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Headers</span>
                                <span className="text-[10px] text-surface-400">{((config.headers as Array<{ key: string; value: string }>) || []).length} headers</span>
                            </button>
                            <div id="api-headers-section" className="px-3 pb-3 space-y-2">
                                {((config.headers as Array<{ key: string; value: string }>) || []).map((header: { key: string; value: string }, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <input
                                            value={header.key}
                                            onChange={(e) => {
                                                const headers = [...((config.headers as Array<{ key: string; value: string }>) || [])];
                                                headers[idx] = { ...headers[idx], key: e.target.value };
                                                updateConfig('headers', headers);
                                            }}
                                            className="input-field flex-1 !py-1.5 text-xs"
                                            placeholder="Content-Type"
                                        />
                                        <input
                                            value={header.value}
                                            onChange={(e) => {
                                                const headers = [...((config.headers as Array<{ key: string; value: string }>) || [])];
                                                headers[idx] = { ...headers[idx], value: e.target.value };
                                                updateConfig('headers', headers);
                                            }}
                                            className="input-field flex-1 !py-1.5 text-xs"
                                            placeholder="application/json"
                                        />
                                        <button
                                            onClick={() => {
                                                const headers = ((config.headers as Array<{ key: string; value: string }>) || []).filter((_: unknown, i: number) => i !== idx);
                                                updateConfig('headers', headers);
                                            }}
                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors flex-shrink-0"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const headers = [...((config.headers as Array<{ key: string; value: string }>) || []), { key: '', value: '' }];
                                        updateConfig('headers', headers);
                                    }}
                                    className="w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-dashed border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Header
                                </button>
                            </div>
                        </div>

                        {/* ─── Request Body (hidden for GET & DELETE) ─── */}
                        {!['GET', 'DELETE'].includes(((config.method as string) || 'GET').toUpperCase()) && (
                            <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                                <div className="px-3 py-2">
                                    <label className="input-label !mb-2">Request Body</label>
                                    <div className="mb-2">
                                        <label className="input-label">Content Type</label>
                                        <select
                                            value={(config.contentType as string) || 'JSON'}
                                            onChange={(e) => updateConfig('contentType', e.target.value)}
                                            className="input-field"
                                        >
                                            <option value="JSON">JSON</option>
                                            <option value="FORM_URLENCODED">Form URL-Encoded</option>
                                            <option value="RAW">Raw Text</option>
                                        </select>
                                    </div>
                                    <textarea
                                        value={(config.body as string) || ''}
                                        onChange={(e) => updateConfig('body', e.target.value)}
                                        className="input-field font-mono text-xs"
                                        rows={5}
                                        placeholder={
                                            (config.contentType as string) === 'FORM_URLENCODED'
                                                ? '{"username": "{{user}}", "action": "login"}'
                                                : (config.contentType as string) === 'RAW'
                                                    ? 'Raw text body...'
                                                    : '{\n  "key": "value",\n  "name": "{{user_name}}"\n}'
                                        }
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Supports {'{{variable}}'} interpolation</p>
                                    {/* JSON validation indicator */}
                                    {((config.contentType as string) || 'JSON') === 'JSON' && (config.body as string) && (() => {
                                        try {
                                            JSON.parse((config.body as string).replace(/\{\{.+?\}\}/g, '"__var__"'));
                                            return <p className="text-xs text-green-500 mt-0.5">✓ Valid JSON</p>;
                                        } catch {
                                            return <p className="text-xs text-red-500 mt-0.5">✗ Invalid JSON syntax</p>;
                                        }
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* ─── Timeout & Retry ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-timeout-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Timeout & Retry</span>
                                <span className="text-[10px] text-surface-400">{(config.timeout as number) || 10}s / Retry: {config.retryEnabled ? 'On' : 'Off'}</span>
                            </button>
                            <div id="api-timeout-section" className="px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Timeout (seconds)</label>
                                    <input
                                        type="number"
                                        value={(config.timeout as number) ?? 10}
                                        onChange={(e) => updateConfig('timeout', Math.max(1, Math.min(120, parseInt(e.target.value) || 10)))}
                                        className="input-field"
                                        min={1}
                                        max={120}
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Min: 1s, Max: 120s, Default: 10s</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="api-retry-toggle"
                                        checked={!!config.retryEnabled}
                                        onChange={(e) => updateConfig('retryEnabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-surface-300 text-violet-600 focus:ring-violet-500"
                                    />
                                    <label htmlFor="api-retry-toggle" className="text-xs font-medium text-surface-700 dark:text-surface-300">Enable Retry on Failure</label>
                                </div>

                                {!!config.retryEnabled && (
                                    <>
                                        <div>
                                            <label className="input-label">Max Retries</label>
                                            <input
                                                type="number"
                                                value={((config.retry as { max?: number; delay?: number })?.max) ?? 3}
                                                onChange={(e) => updateConfig('retry', { ...(config.retry as object || {}), max: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                                                className="input-field"
                                                min={1}
                                                max={10}
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Retry Delay (seconds)</label>
                                            <input
                                                type="number"
                                                value={((config.retry as { max?: number; delay?: number })?.delay) ?? 2}
                                                onChange={(e) => updateConfig('retry', { ...(config.retry as object || {}), delay: Math.max(1, Math.min(30, parseInt(e.target.value) || 2)) })}
                                                className="input-field"
                                                min={1}
                                                max={30}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ─── Response Handling ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-response-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Response Handling</span>
                                <span className="text-[10px] text-surface-400">{((config.responseMapping as Array<unknown>) || []).length} mappings</span>
                            </button>
                            <div id="api-response-section" className="px-3 pb-3 space-y-3">
                                {/* Status Code Variable */}
                                <div>
                                    <label className="input-label">Status Code Variable</label>
                                    <input
                                        value={(config.statusCodeVariable as string) || ''}
                                        onChange={(e) => updateConfig('statusCodeVariable', e.target.value)}
                                        className="input-field text-xs"
                                        placeholder="api_status_code"
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Stores HTTP status (200, 404, etc.)</p>
                                </div>

                                {/* Store Entire Response */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="api-store-entire"
                                            checked={!!config.storeEntireResponse}
                                            onChange={(e) => updateConfig('storeEntireResponse', e.target.checked)}
                                            className="w-4 h-4 rounded border-surface-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <label htmlFor="api-store-entire" className="text-xs font-medium text-surface-700 dark:text-surface-300">Store Entire Response Body</label>
                                    </div>
                                    {!!config.storeEntireResponse && (
                                        <input
                                            value={(config.storeResponseIn as string) || ''}
                                            onChange={(e) => updateConfig('storeResponseIn', e.target.value)}
                                            className="input-field text-xs"
                                            placeholder="api_response"
                                        />
                                    )}
                                </div>

                                {/* Response Mapping */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="input-label !mb-0">Response Mapping</label>
                                        <span className="text-[10px] text-surface-400">{((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).length} mappings</span>
                                    </div>
                                    <p className="text-xs text-surface-500 mb-2">Extract specific fields from the response using dot notation (e.g. <code className="bg-surface-100 dark:bg-surface-800 px-1 rounded">data.user.name</code>)</p>
                                    <div className="space-y-2">
                                        {((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).map((mapping: { jsonPath: string; variableName: string }, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1.5">
                                                <input
                                                    value={mapping.jsonPath}
                                                    onChange={(e) => {
                                                        const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || [])];
                                                        mappings[idx] = { ...mappings[idx], jsonPath: e.target.value };
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="input-field flex-1 !py-1.5 font-mono text-xs"
                                                    placeholder="data.user.name"
                                                />
                                                <span className="text-xs text-surface-400">→</span>
                                                <input
                                                    value={mapping.variableName}
                                                    onChange={(e) => {
                                                        const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || [])];
                                                        mappings[idx] = { ...mappings[idx], variableName: e.target.value };
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="input-field flex-1 !py-1.5 text-xs"
                                                    placeholder="user_name"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const mappings = ((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).filter((_: unknown, i: number) => i !== idx);
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []), { jsonPath: '', variableName: '' }];
                                            updateConfig('responseMapping', mappings);
                                        }}
                                        className="mt-2 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-dashed border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Add Mapping
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ─── Error Handling ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('api-error-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Error Handling</span>
                                <span className="text-[10px] text-surface-400">{(config.errorVariable as string) ? 'Configured' : 'Optional'}</span>
                            </button>
                            <div id="api-error-section" className="px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Error Variable</label>
                                    <input
                                        value={(config.errorVariable as string) || ''}
                                        onChange={(e) => updateConfig('errorVariable', e.target.value)}
                                        className="input-field text-xs"
                                        placeholder="api_error"
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Stores error message on failure. Use in Condition node to branch on errors.</p>
                                </div>
                            </div>
                        </div>

                        {/* ─── Usage Tips ─── */}
                        <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1"><Lightbulb className="w-3.5 h-3.5 inline mr-1" />Tips</p>
                            <ul className="text-xs text-violet-600 dark:text-violet-400 space-y-1 list-disc list-inside">
                                <li>Use <code className="bg-violet-100 dark:bg-violet-900/30 px-1 rounded">{'{{variable}}'}</code> in URL, headers, body, and auth fields</li>
                                <li>For arrays, use <strong>Response Mapping</strong> with <code className="bg-violet-100 dark:bg-violet-900/30 px-1 rounded">data.0.name</code> for first item</li>
                                <li>Feed array responses into a <strong>Loop</strong> node for iteration</li>
                                <li>Use <strong>Status Code Variable</strong> with a <strong>Condition</strong> node for error branching</li>
                            </ul>
                        </div>
                    </>
                )}

                {/* ======================== AI ======================== */}
                {nodeType === 'AI' && (
                    <>
                        {/* ─── Provider Selection ─── */}
                        <div>
                            <label className="input-label">AI Provider</label>
                            <select
                                value={(config.aiProviderId as string) || ''}
                                onChange={(e) => updateConfig('aiProviderId', e.target.value || undefined)}
                                className="input-field"
                            >
                                <option value="">— Select a provider —</option>
                                {aiProviders.filter(p => p.isActive).map((p) => (
                                    <option key={p._id} value={p._id}>{p.name} ({p.provider})</option>
                                ))}
                            </select>
                            <p className="text-xs text-surface-500 mt-1">
                                Configure providers in{' '}
                                <a href="/ai-management" className="text-purple-500 underline">AI Management</a>
                            </p>
                        </div>

                        {/* ─── Model ─── */}
                        <div>
                            <label className="input-label">Model</label>
                            <input
                                value={(config.model as string) || ''}
                                onChange={(e) => updateConfig('model', e.target.value)}
                                className="input-field"
                                placeholder="gpt-4o-mini"
                            />
                        </div>

                        {/* ─── System Prompt ─── */}
                        <div>
                            <label className="input-label">System Prompt</label>
                            <textarea
                                value={(config.systemPrompt as string) || ''}
                                onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                                className="input-field"
                                rows={4}
                                placeholder="You are a helpful customer service agent..."
                            />
                            <p className="text-xs text-surface-500 mt-1">Use {'{{variable}}'} for dynamic content</p>
                        </div>

                        {/* ─── User Message ─── */}
                        <div>
                            <label className="input-label">User Message Template</label>
                            <textarea
                                value={(config.userMessage as string) || ''}
                                onChange={(e) => updateConfig('userMessage', e.target.value)}
                                className="input-field"
                                rows={3}
                                placeholder="User asked: {{last_message}}"
                            />
                        </div>

                        {/* ─── Conversation History ─── */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="ai-include-history"
                                checked={!!config.includeHistory}
                                onChange={(e) => updateConfig('includeHistory', e.target.checked)}
                                className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor="ai-include-history" className="text-xs font-medium text-surface-700 dark:text-surface-300">Include Conversation History</label>
                        </div>
                        {!!config.includeHistory && (
                            <div>
                                <label className="input-label">History Length</label>
                                <input
                                    type="number"
                                    value={(config.historyLength as number) || 10}
                                    onChange={(e) => updateConfig('historyLength', parseInt(e.target.value) || 10)}
                                    className="input-field"
                                    min={1}
                                    max={50}
                                />
                            </div>
                        )}

                        {/* ─── Send to User ─── */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="ai-send-to-user"
                                checked={!!config.sendToUser}
                                onChange={(e) => updateConfig('sendToUser', e.target.checked)}
                                className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor="ai-send-to-user" className="text-xs font-medium text-surface-700 dark:text-surface-300">Send AI Response to User</label>
                        </div>

                        {/* ─── Advanced Parameters ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('ai-params-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Advanced Parameters</span>
                                <span className="text-[10px] text-surface-400">T:{(config.temperature as number) ?? 0.7}</span>
                            </button>
                            <div id="ai-params-section" className="hidden px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Temperature ({(config.temperature as number) ?? 0.7})</label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        value={(config.temperature as number) ?? 0.7}
                                        onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-surface-500">0 = deterministic, 2 = creative</p>
                                </div>
                                <div>
                                    <label className="input-label">Max Tokens</label>
                                    <input
                                        type="number"
                                        value={(config.maxTokens as number) || 500}
                                        onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                                        className="input-field"
                                        min={50}
                                        max={16000}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Top P ({(config.topP as number) ?? 1})</label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={(config.topP as number) ?? 1}
                                        onChange={(e) => updateConfig('topP', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Frequency Penalty ({(config.frequencyPenalty as number) ?? 0})</label>
                                    <input
                                        type="range"
                                        min={-2}
                                        max={2}
                                        step={0.1}
                                        value={(config.frequencyPenalty as number) ?? 0}
                                        onChange={(e) => updateConfig('frequencyPenalty', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Presence Penalty ({(config.presencePenalty as number) ?? 0})</label>
                                    <input
                                        type="range"
                                        min={-2}
                                        max={2}
                                        step={0.1}
                                        value={(config.presencePenalty as number) ?? 0}
                                        onChange={(e) => updateConfig('presencePenalty', parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Response Format</label>
                                    <select
                                        value={(config.responseFormat as string) || 'text'}
                                        onChange={(e) => updateConfig('responseFormat', e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="text">Text</option>
                                        <option value="json_object">JSON Object</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ─── Response Handling ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('ai-response-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Response Handling</span>
                                <span className="text-[10px] text-surface-400">{(config.responseVariable as string) || 'ai_response'}</span>
                            </button>
                            <div id="ai-response-section" className="hidden px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Response Variable</label>
                                    <input
                                        value={(config.responseVariable as string) || ''}
                                        onChange={(e) => updateConfig('responseVariable', e.target.value)}
                                        className="input-field text-xs"
                                        placeholder="ai_response"
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Stores the AI text response as a variable</p>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="ai-store-entire"
                                            checked={!!config.storeEntireResponse}
                                            onChange={(e) => updateConfig('storeEntireResponse', e.target.checked)}
                                            className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <label htmlFor="ai-store-entire" className="text-xs font-medium text-surface-700 dark:text-surface-300">Store Entire Raw Response</label>
                                    </div>
                                    {!!config.storeEntireResponse && (
                                        <input
                                            value={(config.storeResponseIn as string) || ''}
                                            onChange={(e) => updateConfig('storeResponseIn', e.target.value)}
                                            className="input-field text-xs"
                                            placeholder="ai_raw_response"
                                        />
                                    )}
                                </div>

                                {/* Response Mapping */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="input-label !mb-0">Response Mapping</label>
                                        <span className="text-[10px] text-surface-400">{((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).length} mappings</span>
                                    </div>
                                    <p className="text-xs text-surface-500 mb-2">Extract fields from raw response using dot notation</p>
                                    <div className="space-y-2">
                                        {((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).map((mapping: { jsonPath: string; variableName: string }, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1.5">
                                                <input
                                                    value={mapping.jsonPath}
                                                    onChange={(e) => {
                                                        const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || [])];
                                                        mappings[idx] = { ...mappings[idx], jsonPath: e.target.value };
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="input-field flex-1 !py-1.5 font-mono text-xs"
                                                    placeholder="usage.total_tokens"
                                                />
                                                <span className="text-xs text-surface-400">→</span>
                                                <input
                                                    value={mapping.variableName}
                                                    onChange={(e) => {
                                                        const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || [])];
                                                        mappings[idx] = { ...mappings[idx], variableName: e.target.value };
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="input-field flex-1 !py-1.5 text-xs"
                                                    placeholder="total_tokens"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const mappings = ((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []).filter((_: unknown, i: number) => i !== idx);
                                                        updateConfig('responseMapping', mappings);
                                                    }}
                                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const mappings = [...((config.responseMapping as Array<{ jsonPath: string; variableName: string }>) || []), { jsonPath: '', variableName: '' }];
                                            updateConfig('responseMapping', mappings);
                                        }}
                                        className="mt-2 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-dashed border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Add Mapping
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ─── Token Usage ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('ai-token-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Token Usage</span>
                                <span className="text-[10px] text-surface-400">{config.storeTokenUsage ? 'Tracking' : 'Off'}</span>
                            </button>
                            <div id="ai-token-section" className="hidden px-3 pb-3 space-y-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="ai-store-tokens"
                                        checked={!!config.storeTokenUsage}
                                        onChange={(e) => updateConfig('storeTokenUsage', e.target.checked)}
                                        className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="ai-store-tokens" className="text-xs font-medium text-surface-700 dark:text-surface-300">Store Token Usage in Variable</label>
                                </div>
                                {!!config.storeTokenUsage && (
                                    <div>
                                        <label className="input-label">Token Usage Variable</label>
                                        <input
                                            value={(config.tokenUsageVariable as string) || ''}
                                            onChange={(e) => updateConfig('tokenUsageVariable', e.target.value)}
                                            className="input-field text-xs"
                                            placeholder="ai_tokens"
                                        />
                                        <p className="text-xs text-surface-500 mt-1">Stores {'{promptTokens, completionTokens, totalTokens}'}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Error Handling ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('ai-error-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Error Handling</span>
                                <span className="text-[10px] text-surface-400">{(config.errorVariable as string) ? 'Configured' : 'Optional'}</span>
                            </button>
                            <div id="ai-error-section" className="hidden px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Error Variable</label>
                                    <input
                                        value={(config.errorVariable as string) || ''}
                                        onChange={(e) => updateConfig('errorVariable', e.target.value)}
                                        className="input-field text-xs"
                                        placeholder="ai_error"
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Stores error message on failure</p>
                                </div>
                                <div>
                                    <label className="input-label">Fallback Message</label>
                                    <textarea
                                        value={(config.fallbackMessage as string) || ''}
                                        onChange={(e) => updateConfig('fallbackMessage', e.target.value)}
                                        className="input-field"
                                        rows={2}
                                        placeholder="Sorry, I couldn't process that. Please try again."
                                    />
                                    <p className="text-xs text-surface-500 mt-1">Sent to user when AI call fails</p>
                                </div>
                            </div>
                        </div>

                        {/* ─── Timeout & Retry ─── */}
                        <div className="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('ai-timeout-section');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Timeout & Retry</span>
                                <span className="text-[10px] text-surface-400">{(config.timeout as number) || 30}s / Retry: {config.retryEnabled ? 'On' : 'Off'}</span>
                            </button>
                            <div id="ai-timeout-section" className="hidden px-3 pb-3 space-y-3">
                                <div>
                                    <label className="input-label">Timeout (seconds)</label>
                                    <input
                                        type="number"
                                        value={(config.timeout as number) ?? 30}
                                        onChange={(e) => updateConfig('timeout', Math.max(1, Math.min(120, parseInt(e.target.value) || 30)))}
                                        className="input-field"
                                        min={1}
                                        max={120}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="ai-retry-toggle"
                                        checked={!!config.retryEnabled}
                                        onChange={(e) => updateConfig('retryEnabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="ai-retry-toggle" className="text-xs font-medium text-surface-700 dark:text-surface-300">Enable Retry on Failure</label>
                                </div>
                                {!!config.retryEnabled && (
                                    <>
                                        <div>
                                            <label className="input-label">Max Retries</label>
                                            <input
                                                type="number"
                                                value={((config.retry as { max?: number; delay?: number })?.max) ?? 3}
                                                onChange={(e) => updateConfig('retry', { ...(config.retry as object || {}), max: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                                                className="input-field"
                                                min={1}
                                                max={10}
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Retry Delay (seconds)</label>
                                            <input
                                                type="number"
                                                value={((config.retry as { max?: number; delay?: number })?.delay) ?? 2}
                                                onChange={(e) => updateConfig('retry', { ...(config.retry as object || {}), delay: Math.max(1, Math.min(30, parseInt(e.target.value) || 2)) })}
                                                className="input-field"
                                                min={1}
                                                max={30}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ─── Tips ─── */}
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1"><Lightbulb className="w-3.5 h-3.5 inline mr-1" />Tips</p>
                            <ul className="text-xs text-purple-600 dark:text-purple-400 space-y-1 list-disc list-inside">
                                <li>Use <code className="bg-purple-100 dark:bg-purple-900/30 px-1 rounded">{'{{variable}}'}</code> in prompts for dynamic content</li>
                                <li>Success/Error edges let you branch on AI API results</li>
                                <li>View logs and token usage in <strong>AI Management</strong></li>
                                <li>Lower temperature = more consistent, higher = more creative</li>
                            </ul>
                        </div>
                    </>
                )}

                {/* ======================== LOOP ======================== */}
                {nodeType === 'LOOP' && (
                    <>
                        <div>
                            <label className="input-label">Array Variable</label>
                            <input
                                value={(config.arrayVariable as string) || ''}
                                onChange={(e) => updateConfig('arrayVariable', e.target.value)}
                                className="input-field"
                                placeholder="{{items}}"
                            />
                        </div>
                        <div>
                            <label className="input-label">Item Variable Name</label>
                            <input
                                value={(config.itemVariable as string) || ''}
                                onChange={(e) => updateConfig('itemVariable', e.target.value)}
                                className="input-field"
                                placeholder="current_item"
                            />
                        </div>
                        <div>
                            <label className="input-label">Max Iterations</label>
                            <input
                                type="number"
                                value={(config.maxIterations as number) || 10}
                                onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value))}
                                className="input-field"
                                min={1}
                                max={100}
                            />
                        </div>
                    </>
                )}

                {/* ======================== END ======================== */}
                {nodeType === 'END' && (
                    <div>
                        <label className="input-label">Farewell Message (optional)</label>
                        <textarea
                            value={(config.finalMessage as string) || ''}
                            onChange={(e) => updateConfig('finalMessage', e.target.value)}
                            className="input-field"
                            rows={3}
                            placeholder="Thank you! Goodbye."
                        />
                    </div>
                )}

                {/* ======================== GOTO_SUBFLOW ======================== */}
                {nodeType === 'GOTO_SUBFLOW' && (
                    <div>
                        <label className="input-label">Target Subflow</label>
                        <select
                            value={(config.targetFlowId as string) || ''}
                            onChange={(e) => updateConfig('targetFlowId', e.target.value)}
                            className="input-field"
                        >
                            <option value="">— Select a subflow —</option>
                            {subflows.map((sf) => (
                                <option key={sf._id} value={sf._id}>
                                    {sf.name}
                                </option>
                            ))}
                        </select>
                        {subflows.length === 0 && (
                            <p className="text-xs text-surface-500 mt-1 italic">No subflows available. Create a subflow first.</p>
                        )}
                    </div>
                )}

                {/* Node ID */}
                <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                    <p className="text-xs text-surface-400 font-mono truncate">ID: {node.id}</p>
                </div>
            </div>

            {/* Delete */}
            {nodeType !== 'START' && (
                <div className="p-4 border-t border-surface-200 dark:border-surface-700">
                    <button
                        onClick={() => onDelete(node.id)}
                        className="w-full btn-danger flex items-center justify-center gap-2 text-sm"
                    >
                        <Trash2 className="w-4 h-4" /> Delete Node
                    </button>
                </div>
            )}
        </div>
    );
}
