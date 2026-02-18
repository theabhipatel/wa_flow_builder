import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { IFlow } from '../types';
import { Plus, GitBranch, ArrowLeft, Trash2, CheckCircle, Clock, Loader2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export default function FlowListPage() {
    const { botId } = useParams();
    const navigate = useNavigate();
    const [flows, setFlows] = useState<IFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; flowId: string }>({ isOpen: false, flowId: '' });
    const toast = useToast();

    const fetchFlows = async () => {
        try {
            const res = await api.get(`/bots/${botId}/flows`);
            if (res.data.success) setFlows(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFlows(); }, [botId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await api.post(`/bots/${botId}/flows`, { name: newName, description: newDesc });
            if (res.data.success) {
                setShowCreate(false);
                setNewName('');
                setNewDesc('');
                fetchFlows();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (flowId: string) => {
        setConfirmModal({ isOpen: false, flowId: '' });
        try {
            await api.delete(`/bots/${botId}/flows/${flowId}`);
            setFlows(flows.filter((f) => f._id !== flowId));
            toast.success('Flow deleted successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete flow');
        }
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            <button onClick={() => navigate('/bots')} className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-6">
                <ArrowLeft className="w-4 h-4" /> Back to Bots
            </button>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Flows</h1>
                    <p className="text-surface-500 mt-1">Build and manage conversational flows</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> New Flow
                </button>
            </div>

            {/* Create flow modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
                    <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-4">Create New Flow</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="input-label">Flow Name</label>
                                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" placeholder="Welcome Flow" required />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="input-field" placeholder="What does this flow do?" rows={3} />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2">
                                    {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="card p-6 animate-pulse"><div className="h-6 w-40 bg-surface-200 dark:bg-surface-700 rounded" /></div>)}
                </div>
            ) : flows.length === 0 ? (
                <div className="card p-12 text-center">
                    <GitBranch className="w-16 h-16 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No flows yet</h3>
                    <p className="text-surface-500 mb-4">Create your first flow to start building a conversation.</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary">Create Flow</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {flows.map((flow) => (
                        <div key={flow._id} className="card p-5 flex items-center gap-4 group hover:scale-[1.01] transition-all duration-200">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                                <GitBranch className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold">{flow.name}</h3>
                                {flow.description && <p className="text-sm text-surface-500 truncate">{flow.description}</p>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-surface-500">
                                {flow.isDeployed ? (
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle className="w-3.5 h-3.5" /> v{flow.productionVersion}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" /> Draft
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/builder/${botId}/${flow._id}`)}
                                    className="btn-primary text-sm py-2 px-4"
                                >
                                    Open Builder
                                </button>
                                {!flow.isMainFlow && (
                                    <button onClick={() => setConfirmModal({ isOpen: true, flowId: flow._id })} className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-400 hover:text-red-500 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Delete Flow"
                message="Delete this flow and all its versions? This action cannot be undone."
                confirmLabel="Delete Flow"
                variant="danger"
                onConfirm={() => handleDelete(confirmModal.flowId)}
                onCancel={() => setConfirmModal({ isOpen: false, flowId: '' })}
            />
        </div>
    );
}
