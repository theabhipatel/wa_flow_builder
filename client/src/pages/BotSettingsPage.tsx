import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { IBot, IBotVariable } from '../types';
import { ArrowLeft, Phone, Check, X, Plus, Trash2, Loader2, Save, Copy, Link, Shield, Wifi, WifiOff, MessageCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function BotSettingsPage() {
    const { botId } = useParams();
    const navigate = useNavigate();
    const [bot, setBot] = useState<IBot | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Bot info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [defaultFallbackMessage, setDefaultFallbackMessage] = useState('');

    // WhatsApp
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verifyToken, setVerifyToken] = useState('');
    const [waSaving, setWaSaving] = useState(false);
    const [waChecking, setWaChecking] = useState(false);
    const [waError, setWaError] = useState('');
    const [waSuccess, setWaSuccess] = useState('');
    const [copied, setCopied] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    // Variables
    const [variables, setVariables] = useState<IBotVariable[]>([]);
    const [newVarName, setNewVarName] = useState('');
    const [newVarValue, setNewVarValue] = useState('');

    const webhookUrl = `${API_URL}/api/webhook/whatsapp/${botId}`;

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get(`/bots/${botId}`);
                if (res.data.success) {
                    const b = res.data.data;
                    setBot(b);
                    setName(b.name);
                    setDescription(b.description || '');
                    setDefaultFallbackMessage(b.defaultFallbackMessage || '');
                    if (b.whatsapp) {
                        setPhoneNumberId(b.whatsapp.phoneNumberId);
                        setPhoneNumber(b.whatsapp.phoneNumber);
                        setVerifyToken(b.whatsapp.verifyToken || '');
                        setSettingsSaved(true);
                    }
                }

                const varRes = await api.get(`/bots/${botId}/variables`);
                if (varRes.data.success) setVariables(varRes.data.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [botId]);

    const saveBotInfo = async () => {
        setSaving(true);
        try {
            await api.put(`/bots/${botId}`, { name, description, defaultFallbackMessage: defaultFallbackMessage || undefined });
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    /** Step 1: Save WhatsApp settings to DB (no Meta API validation) */
    const saveWhatsAppSettings = async () => {
        setWaSaving(true);
        setWaError('');
        setWaSuccess('');
        try {
            const res = await api.post(`/bots/${botId}/whatsapp/connect`, {
                phoneNumberId, accessToken, phoneNumber, verifyToken,
            });
            if (res.data.success) {
                setWaSuccess(res.data.message || 'WhatsApp settings saved successfully!');
                setSettingsSaved(true);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setWaError(axiosErr.response?.data?.error || 'Failed to save settings');
        } finally {
            setWaSaving(false);
        }
    };

    /** Step 2: Check connection against Meta API */
    const checkConnection = async () => {
        setWaChecking(true);
        setWaError('');
        setWaSuccess('');
        try {
            const res = await api.post(`/bots/${botId}/whatsapp/check`);
            if (res.data.success) {
                setWaSuccess(res.data.message || 'Connection verified!');
                setBot({ ...bot!, isWhatsAppConnected: true });
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setWaError(axiosErr.response?.data?.error || 'Connection check failed');
            setBot({ ...bot!, isWhatsAppConnected: false });
        } finally {
            setWaChecking(false);
        }
    };

    const disconnectWhatsApp = async () => {
        if (!confirm('Disconnect WhatsApp?')) return;
        try {
            await api.delete(`/bots/${botId}/whatsapp/disconnect`);
            setBot({ ...bot!, isWhatsAppConnected: false });
            setPhoneNumberId('');
            setAccessToken('');
            setPhoneNumber('');
            setVerifyToken('');
            setSettingsSaved(false);
            setWaSuccess('');
            setWaError('');
        } catch (err) {
            console.error(err);
        }
    };

    const copyWebhookUrl = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const addVariable = async () => {
        if (!newVarName.trim()) return;
        try {
            const res = await api.post(`/bots/${botId}/variables`, {
                variableName: newVarName, variableValue: newVarValue, variableType: 'STRING',
            });
            if (res.data.success) {
                setVariables([...variables, res.data.data]);
                setNewVarName('');
                setNewVarValue('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteVariable = async (varName: string) => {
        try {
            await api.delete(`/bots/${botId}/variables/${varName}`);
            setVariables(variables.filter((v) => v.variableName !== varName));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-6">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <h1 className="text-2xl font-bold mb-6">Bot Settings — {bot?.name}</h1>

            {/* Bot Info */}
            <div className="card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">General</h2>
                <div className="space-y-4">
                    <div>
                        <label className="input-label">Bot Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label className="input-label">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" rows={3} />
                    </div>
                    <button onClick={saveBotInfo} disabled={saving} className="btn-primary flex items-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </button>
                </div>
            </div>

            {/* Bot Behavior */}
            <div className="card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-brand-500" /> Bot Behavior
                </h2>
                <p className="text-sm text-surface-500 mb-4">
                    Configure how the bot responds to unrecognized messages. Users can type <strong>"Hi"</strong> or <strong>"Hello"</strong> at any time to restart the conversation.
                </p>
                <div>
                    <label className="input-label">Default Fallback Message</label>
                    <p className="text-xs text-surface-500 mb-2">
                        This message is sent when a user types something unexpected (e.g., random text when a button click is expected). Leave empty to use the default.
                    </p>
                    <textarea
                        value={defaultFallbackMessage}
                        onChange={(e) => setDefaultFallbackMessage(e.target.value)}
                        className="input-field"
                        rows={3}
                        placeholder="I didn't understand. Please choose an option or send Hi to start again."
                    />
                </div>
                <button onClick={saveBotInfo} disabled={saving} className="btn-primary flex items-center gap-2 mt-4">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
            </div>

            {/* WhatsApp Connection */}
            <div className="card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Phone className="w-5 h-5 text-emerald-500" /> WhatsApp Connection
                    </h2>
                    {bot?.isWhatsAppConnected ? (
                        <span className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <Wifi className="w-3.5 h-3.5" /> Connected
                        </span>
                    ) : settingsSaved ? (
                        <span className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <WifiOff className="w-3.5 h-3.5" /> Settings Saved
                        </span>
                    ) : null}
                </div>

                {/* Webhook URL Section */}
                <div className="mb-5 p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Link className="w-4 h-4 text-brand-500" />
                        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Webhook URL</label>
                    </div>
                    <p className="text-xs text-surface-500 mb-3">Copy this URL and paste it into your Meta Developer App → WhatsApp → Configuration → Callback URL</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 overflow-x-auto whitespace-nowrap">
                            {webhookUrl}
                        </code>
                        <button
                            onClick={copyWebhookUrl}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 ${copied
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-brand-500 hover:bg-brand-600 text-white'
                                }`}
                        >
                            {copied ? (
                                <><Check className="w-4 h-4" /> Copied!</>
                            ) : (
                                <><Copy className="w-4 h-4" /> Copy</>
                            )}
                        </button>
                    </div>
                </div>

                {waError && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{waError}</div>}
                {waSuccess && <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm">{waSuccess}</div>}

                {/* Step-by-step instructions */}
                <div className="mb-5 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Setup Steps:</p>
                    <ol className="text-xs text-blue-600 dark:text-blue-400/80 space-y-1 list-decimal list-inside">
                        <li className={settingsSaved ? 'line-through opacity-60' : 'font-medium'}>Fill in all fields below and click <strong>"Save Settings"</strong></li>
                        <li className={settingsSaved && !bot?.isWhatsAppConnected ? 'font-medium' : settingsSaved ? 'line-through opacity-60' : 'opacity-60'}>Copy the Webhook URL & Verify Token above into <strong>Meta Developer App → WhatsApp → Configuration</strong></li>
                        <li className={bot?.isWhatsAppConnected ? 'line-through opacity-60' : settingsSaved ? 'font-medium' : 'opacity-60'}>Click <strong>"Check Connection"</strong> to verify everything works</li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="input-label">Phone Number ID</label>
                        <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className="input-field" placeholder="e.g. 123456789012345" />
                    </div>
                    <div>
                        <label className="input-label">Access Token</label>
                        <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="input-field" placeholder="Bearer token from Meta" type="password" />
                    </div>
                    <div>
                        <label className="input-label">Phone Number (with country code)</label>
                        <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="input-field" placeholder="e.g. +919876543210" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-amber-500" />
                            <label className="input-label" style={{ marginBottom: 0 }}>Verify Token</label>
                        </div>
                        <p className="text-xs text-surface-500 mb-2">Enter any secret string. Use the same value in Meta Developer App → Webhook Configuration → Verify Token.</p>
                        <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className="input-field" placeholder="e.g. my-secret-verify-token-123" />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 pt-2">
                        {/* Step 1: Save Settings */}
                        <button onClick={saveWhatsAppSettings} disabled={waSaving} className="btn-primary flex items-center gap-2">
                            {waSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {settingsSaved ? 'Update Settings' : 'Save Settings'}
                        </button>

                        {/* Step 2: Check Connection (only after settings are saved) */}
                        {settingsSaved && (
                            <button
                                onClick={checkConnection}
                                disabled={waChecking}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${bot?.isWhatsAppConnected
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                    }`}
                            >
                                {waChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                                Check Connection
                            </button>
                        )}

                        {/* Disconnect */}
                        {settingsSaved && (
                            <button onClick={disconnectWhatsApp} className="btn-danger flex items-center gap-2">
                                <X className="w-4 h-4" /> Disconnect
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bot Variables */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Bot Variables</h2>
                <p className="text-sm text-surface-500 mb-4">Global variables shared across all flows and sessions.</p>

                {variables.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {variables.map((v) => (
                            <div key={v.variableName} className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                                <code className="text-sm font-mono text-brand-600 dark:text-brand-400 flex-1">{`{{${v.variableName}}}`}</code>
                                <span className="text-sm text-surface-500 flex-1">{String(v.variableValue)}</span>
                                <button onClick={() => deleteVariable(v.variableName)} className="p-1 text-surface-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} className="input-field flex-1" placeholder="Variable name" />
                    <input value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} className="input-field flex-1" placeholder="Value" />
                    <button onClick={addVariable} className="btn-primary px-3"><Plus className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}
