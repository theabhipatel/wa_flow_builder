import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import {
    Plus, Edit2, Trash2, Loader2, Check, X, TestTube2,
    Brain, Activity, BarChart3, AlertCircle, CheckCircle2,
    Clock, Zap, ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface AIProvider {
    _id: string;
    name: string;
    provider: string;
    baseUrl: string;
    defaultModel: string;
    isActive: boolean;
    maskedKey: string;
    createdAt: string;
}

interface AIApiLog {
    _id: string;
    botName: string;
    nodeId: string;
    nodeLabel: string;
    providerName: string;
    provider: string;
    modelName: string;
    status: 'SUCCESS' | 'ERROR';
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errorMessage: string | null;
    errorCode: string | null;
    responseTimeMs: number;
    createdAt: string;
}

interface UsageStats {
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    successRate: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    byProvider: Array<{ _id: string; totalCalls: number; successCalls: number; errorCalls: number; totalTokens: number }>;
    byBot: Array<{ _id: string; botName: string; totalCalls: number; successCalls: number; errorCalls: number; totalTokens: number }>;
}

const PROVIDER_OPTIONS = [
    { value: 'OPENAI', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
    { value: 'GEMINI', label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
    { value: 'GROQ', label: 'Groq', defaultUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
    { value: 'MISTRAL', label: 'Mistral AI', defaultUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest' },
    { value: 'OPENROUTER', label: 'OpenRouter', defaultUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini' },
    { value: 'CUSTOM', label: 'Custom / Self-hosted', defaultUrl: '', defaultModel: '' },
];

// ─── Main Component ─────────────────────────────────────────────
export default function AIManagementPage() {
    const [activeTab, setActiveTab] = useState<'providers' | 'logs' | 'usage'>('providers');

    const tabs = [
        { key: 'providers' as const, label: 'Providers', icon: Brain },
        { key: 'logs' as const, label: 'API Logs', icon: Activity },
        { key: 'usage' as const, label: 'Usage Stats', icon: BarChart3 },
    ];

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">AI Management</h1>
                    <p className="text-sm text-surface-500">Manage AI providers, monitor API usage, and track costs</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.key
                            ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'providers' && <ProvidersTab />}
            {activeTab === 'logs' && <LogsTab />}
            {activeTab === 'usage' && <UsageTab />}
        </div>
    );
}

// ─── Providers Tab ──────────────────────────────────────────────
function ProvidersTab() {
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; valid: boolean } | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        defaultModel: 'gpt-4o-mini',
    });

    const fetchProviders = useCallback(async () => {
        try {
            const res = await api.get('/ai-providers');
            if (res.data.success) setProviders(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProviders(); }, [fetchProviders]);

    const resetForm = () => {
        setFormData({ name: '', provider: 'OPENAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', defaultModel: 'gpt-4o-mini' });
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const handleProviderChange = (provider: string) => {
        const preset = PROVIDER_OPTIONS.find((p) => p.value === provider);
        setFormData((prev) => ({
            ...prev,
            provider,
            baseUrl: preset?.defaultUrl || '',
            defaultModel: preset?.defaultModel || '',
        }));
    };

    const handleSave = async () => {
        setError('');
        setSuccess('');
        if (!formData.name.trim() || !formData.apiKey.trim()) {
            setError('Name and API key are required');
            return;
        }
        try {
            if (editingId) {
                await api.put(`/ai-providers/${editingId}`, formData);
                setSuccess('Provider updated successfully');
            } else {
                await api.post('/ai-providers', formData);
                setSuccess('Provider added successfully');
            }
            resetForm();
            fetchProviders();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setError(axiosErr.response?.data?.error || 'Failed to save provider');
        }
    };

    const handleEdit = (provider: AIProvider) => {
        setFormData({
            name: provider.name,
            provider: provider.provider,
            baseUrl: provider.baseUrl,
            defaultModel: provider.defaultModel,
            apiKey: '',
        });
        setEditingId(provider._id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this AI provider?')) return;
        try {
            await api.delete(`/ai-providers/${id}`);
            fetchProviders();
            setSuccess('Provider deleted');
        } catch (err) {
            console.error(err);
        }
    };

    const handleTest = async (id: string) => {
        setTestingId(id);
        setTestResult(null);
        try {
            const res = await api.post(`/ai-providers/${id}/test`);
            setTestResult({ id, valid: res.data.data.isValid });
        } catch {
            setTestResult({ id, valid: false });
        } finally {
            setTestingId(null);
        }
    };

    const handleToggleActive = async (provider: AIProvider) => {
        try {
            await api.put(`/ai-providers/${provider._id}`, { isActive: !provider.isActive });
            fetchProviders();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm">{success}</div>}

            {/* Add Provider Button */}
            {!showForm && (
                <button
                    onClick={() => { setShowForm(true); setEditingId(null); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Add AI Provider
                </button>
            )}

            {/* Provider Form */}
            {showForm && (
                <div className="card p-5 space-y-4 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{editingId ? 'Edit Provider' : 'Add New Provider'}</h3>
                        <button onClick={resetForm} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Name</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                className="input-field"
                                placeholder="My OpenAI Key"
                            />
                        </div>
                        <div>
                            <label className="input-label">Provider</label>
                            <CustomSelect
                                value={formData.provider}
                                onChange={(val) => handleProviderChange(val)}
                                options={PROVIDER_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                            />
                        </div>
                        <div>
                            <label className="input-label">API Key</label>
                            <input
                                type="password"
                                value={formData.apiKey}
                                onChange={(e) => setFormData((p) => ({ ...p, apiKey: e.target.value }))}
                                className="input-field"
                                placeholder={editingId ? 'Leave blank to keep existing' : 'sk-...'}
                            />
                        </div>
                        <div>
                            <label className="input-label">Default Model</label>
                            <input
                                value={formData.defaultModel}
                                onChange={(e) => setFormData((p) => ({ ...p, defaultModel: e.target.value }))}
                                className="input-field"
                                placeholder="gpt-4o-mini"
                            />
                        </div>
                        {formData.provider === 'CUSTOM' && (
                            <div className="md:col-span-2">
                                <label className="input-label">Base URL</label>
                                <input
                                    value={formData.baseUrl}
                                    onChange={(e) => setFormData((p) => ({ ...p, baseUrl: e.target.value }))}
                                    className="input-field"
                                    placeholder="https://your-server.com/v1"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4" /> {editingId ? 'Update' : 'Save'}
                        </button>
                        <button onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* Providers List */}
            {providers.length === 0 && !showForm && (
                <div className="card p-10 text-center">
                    <Brain className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                    <p className="text-surface-500 text-sm">No AI providers configured yet</p>
                    <p className="text-surface-400 text-xs mt-1">Add a provider to start using AI nodes in your flows</p>
                </div>
            )}

            <div className="space-y-3">
                {providers.map((provider) => (
                    <div
                        key={provider._id}
                        className={`card p-4 flex items-center justify-between transition-opacity ${!provider.isActive ? 'opacity-50' : ''}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                                <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">{provider.name}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                        {provider.provider}
                                    </span>
                                    {!provider.isActive && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                            Disabled
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    Key: {provider.maskedKey} · Model: {provider.defaultModel || '(none)'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {testResult?.id === provider._id && (
                                <span className={`text-xs font-medium flex items-center gap-1 ${testResult.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {testResult.valid
                                        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Valid</>
                                        : <><AlertCircle className="w-3.5 h-3.5" /> Invalid</>
                                    }
                                </span>
                            )}
                            <button
                                onClick={() => handleTest(provider._id)}
                                disabled={testingId === provider._id}
                                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                title="Test connection"
                            >
                                {testingId === provider._id
                                    ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                    : <TestTube2 className="w-4 h-4 text-surface-500" />
                                }
                            </button>
                            <button
                                onClick={() => handleToggleActive(provider)}
                                className={`p-2 rounded-lg transition-colors ${provider.isActive ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                                title={provider.isActive ? 'Disable' : 'Enable'}
                            >
                                <Zap className={`w-4 h-4 ${provider.isActive ? 'text-emerald-500' : 'text-surface-400'}`} />
                            </button>
                            <button
                                onClick={() => handleEdit(provider)}
                                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                title="Edit"
                            >
                                <Edit2 className="w-4 h-4 text-surface-500" />
                            </button>
                            <button
                                onClick={() => handleDelete(provider._id)}
                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Logs Tab ───────────────────────────────────────────────────
function LogsTab() {
    const [logs, setLogs] = useState<AIApiLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), limit: '20' };
            if (statusFilter) params.status = statusFilter;
            const res = await api.get('/ai-logs/logs', { params });
            if (res.data.success) {
                setLogs(res.data.data.logs);
                setTotalPages(res.data.data.totalPages);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
                <CustomSelect
                    value={statusFilter}
                    onChange={(val) => { setStatusFilter(val); setPage(1); }}
                    options={[
                        { value: '', label: 'All Status' },
                        { value: 'SUCCESS', label: 'Success', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
                        { value: 'ERROR', label: 'Error', icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" /> },
                    ]}
                    className="w-44"
                />
                <span className="text-xs text-surface-500">Showing page {page} of {totalPages}</span>
            </div>

            {/* Logs Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
            ) : logs.length === 0 ? (
                <div className="card p-10 text-center">
                    <Activity className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                    <p className="text-surface-500 text-sm">No API logs yet</p>
                    <p className="text-surface-400 text-xs mt-1">Logs will appear here when AI nodes are executed</p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Time</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Bot / Node</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Provider</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Model</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Tokens</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Time</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log._id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                                        <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">
                                            <Clock className="w-3 h-3 inline mr-1" />{formatTime(log.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-medium">{log.botName}</p>
                                            <p className="text-[10px] text-surface-400">{log.nodeLabel || log.nodeId}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                                {log.provider || log.providerName}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-surface-600 dark:text-surface-400">{log.modelName}</td>
                                        <td className="px-4 py-3 text-center">
                                            {log.status === 'SUCCESS'
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                : <AlertCircle className="w-4 h-4 text-red-500 mx-auto" />
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-mono">
                                            {log.totalTokens > 0 ? log.totalTokens.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-surface-500">
                                            {log.responseTimeMs}ms
                                        </td>
                                        <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate" title={log.errorMessage || ''}>
                                            {log.errorMessage || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <span className="text-xs text-surface-500">Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 disabled:opacity-50"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Usage Tab ──────────────────────────────────────────────────
function UsageTab() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/ai-logs/stats');
                if (res.data.success) setStats(res.data.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!stats) {
        return <div className="card p-10 text-center text-surface-500 text-sm">Failed to load usage stats</div>;
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total API Calls" value={stats.totalCalls.toLocaleString()} icon={<Activity className="w-5 h-5" />} color="purple" />
                <StatCard label="Success Rate" value={`${stats.successRate}%`} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
                <StatCard label="Total Tokens" value={stats.totalTokens.toLocaleString()} icon={<Zap className="w-5 h-5" />} color="amber" />
                <StatCard label="Errors" value={stats.errorCalls.toLocaleString()} icon={<AlertCircle className="w-5 h-5" />} color="red" />
            </div>

            {/* Token Breakdown */}
            <div className="card p-5">
                <h3 className="font-semibold text-sm mb-4">Token Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.promptTokens.toLocaleString()}</p>
                        <p className="text-xs text-surface-500 mt-1">Prompt Tokens</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.completionTokens.toLocaleString()}</p>
                        <p className="text-xs text-surface-500 mt-1">Completion Tokens</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalTokens.toLocaleString()}</p>
                        <p className="text-xs text-surface-500 mt-1">Total Tokens</p>
                    </div>
                </div>
            </div>

            {/* By Provider */}
            {stats.byProvider.length > 0 && (
                <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4">Usage by Provider</h3>
                    <div className="space-y-3">
                        {stats.byProvider.map((item) => (
                            <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                        {item._id}
                                    </span>
                                    <span className="text-xs text-surface-500">{item.totalCalls} calls</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs">
                                        <span className="text-emerald-600">{item.successCalls} ✓</span>
                                        {' / '}
                                        <span className="text-red-500">{item.errorCalls} ✗</span>
                                    </span>
                                    <span className="text-xs font-mono text-surface-600 dark:text-surface-400">
                                        {item.totalTokens.toLocaleString()} tokens
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* By Bot */}
            {stats.byBot.length > 0 && (
                <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4">Usage by Bot</h3>
                    <div className="space-y-3">
                        {stats.byBot.map((item) => (
                            <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium">{item.botName}</span>
                                    <span className="text-xs text-surface-500">{item.totalCalls} calls</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs">
                                        <span className="text-emerald-600">{item.successCalls} ✓</span>
                                        {' / '}
                                        <span className="text-red-500">{item.errorCalls} ✗</span>
                                    </span>
                                    <span className="text-xs font-mono text-surface-600 dark:text-surface-400">
                                        {item.totalTokens.toLocaleString()} tokens
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stat Card Component ────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
    const colorMap: Record<string, string> = {
        purple: 'from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400',
        emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
        amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400',
        red: 'from-red-500/10 to-red-500/5 text-red-600 dark:text-red-400',
    };

    return (
        <div className={`card p-4 bg-gradient-to-br ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium">{label}</span></div>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}

// ─── Custom Select Component ────────────────────────────────────
function CustomSelect({
    value,
    onChange,
    options,
    className = '',
}: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selected = options.find((o) => o.value === value) || options[0];

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-purple-300 dark:hover:border-purple-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
                <span className="flex items-center gap-2 truncate">
                    {selected?.icon}
                    {selected?.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-[160px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-lg shadow-black/10 dark:shadow-black/30 py-1 animate-fade-in">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${opt.value === value
                                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 font-medium'
                                    : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                                }`}
                        >
                            {opt.icon}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
