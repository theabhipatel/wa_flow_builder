import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import api from '../lib/api';
import { IDashboardStats } from '../types';
import { Bot, GitBranch, MessageSquare, Activity, TrendingUp, Users } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [stats, setStats] = useState<IDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/analytics/dashboard');
                if (res.data.success) {
                    setStats(res.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        { label: 'Total Bots', value: stats?.totalBots ?? 0, icon: Bot, color: 'from-brand-500 to-brand-600', bgColor: 'bg-brand-50 dark:bg-brand-900/30' },
        { label: 'Total Flows', value: stats?.totalFlows ?? 0, icon: GitBranch, color: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
        { label: 'Active Sessions', value: stats?.activeSessions ?? 0, icon: Activity, color: 'from-amber-500 to-orange-600', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
        { label: 'Messages (24h)', value: stats?.messagesSent24h ?? 0, icon: MessageSquare, color: 'from-cyan-500 to-blue-600', bgColor: 'bg-cyan-50 dark:bg-cyan-900/30' },
        { label: 'Completion Rate', value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp, color: 'from-violet-500 to-purple-600', bgColor: 'bg-violet-50 dark:bg-violet-900/30' },
        { label: 'Total Sessions', value: stats?.totalSessions ?? 0, icon: Users, color: 'from-pink-500 to-rose-600', bgColor: 'bg-pink-50 dark:bg-pink-900/30' },
    ];

    return (
        <div className="max-w-7xl mx-auto animate-fade-in">
            <div className="mb-8">
                <h1 className="text-2xl font-bold">
                    Welcome back, <span className="gradient-text">{user?.firstName || user?.email?.split('@')[0]}</span>
                </h1>
                <p className="text-surface-500 mt-1">Here's an overview of your platform.</p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="h-10 w-10 rounded-xl bg-surface-200 dark:bg-surface-700 mb-4" />
                            <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
                            <div className="h-8 w-16 bg-surface-200 dark:bg-surface-700 rounded" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="card p-6 hover:scale-[1.02] transition-transform duration-200">
                            <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center mb-4`}>
                                <card.icon className={`w-5 h-5 text-brand-600 dark:text-brand-400`} />
                            </div>
                            <p className="text-sm text-surface-500 mb-1">{card.label}</p>
                            <p className="text-3xl font-bold">{card.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick actions */}
            <div className="mt-8 card p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a href="/bots" className="p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors group">
                        <Bot className="w-6 h-6 text-brand-600 dark:text-brand-400 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="font-medium text-sm">Create New Bot</p>
                        <p className="text-xs text-surface-500 mt-1">Set up a new WhatsApp bot</p>
                    </a>
                    <a href="/bots" className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group">
                        <GitBranch className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="font-medium text-sm">Build a Flow</p>
                        <p className="text-xs text-surface-500 mt-1">Design conversational flows</p>
                    </a>
                    <a href="/settings" className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors group">
                        <Activity className="w-6 h-6 text-violet-600 dark:text-violet-400 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="font-medium text-sm">Configure API</p>
                        <p className="text-xs text-surface-500 mt-1">Add OpenAI credentials</p>
                    </a>
                </div>
            </div>
        </div>
    );
}
