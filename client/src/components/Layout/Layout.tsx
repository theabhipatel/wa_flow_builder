import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/authSlice';
import { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Bot,
    Brain,
    Shield,
    LogOut,
    Sun,
    Moon,
    Menu,
    X,
    MessageSquare,
} from 'lucide-react';

export default function Layout() {
    const { user } = useSelector((state: RootState) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (dark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/bots', icon: Bot, label: 'Bots' },
        { to: '/ai-management', icon: Brain, label: 'AI Management' },
        ...(user?.role === 'ADMIN' ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    ];

    return (
        <div className="flex h-screen bg-surface-50 dark:bg-surface-950 overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-0 md:w-20'
                    } bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 flex flex-col transition-all duration-300 overflow-hidden`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-4 border-b border-surface-200 dark:border-surface-700">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <h1 className="font-bold text-sm gradient-text whitespace-nowrap">WA Flow Builder</h1>
                            <p className="text-[10px] text-surface-500 whitespace-nowrap">Visual Automation</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* User section — clickable to profile */}
                <div className="p-3 border-t border-surface-200 dark:border-surface-700">
                    <button
                        onClick={() => navigate('/profile')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                                {(user?.firstName?.[0] || '').toUpperCase()}{(user?.lastName?.[0] || '').toUpperCase()}
                            </span>
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                                <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                            </div>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header className="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-6">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setDark(!dark)}
                            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm text-surface-500 hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
