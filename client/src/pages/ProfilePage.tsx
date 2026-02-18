import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { loginSuccess } from '../store/authSlice';
import api from '../lib/api';
import {
    User,
    Mail,
    Shield,
    Calendar,
    Loader2,
    Check,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    Copy,
} from 'lucide-react';

export default function ProfilePage() {
    const { user, token } = useSelector((state: RootState) => state.auth);
    const dispatch = useDispatch();

    // Profile form
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');

    // Password form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [idCopied, setIdCopied] = useState(false);

    const handleCopyId = async () => {
        if (!user?.id) return;
        await navigator.clipboard.writeText(user.id);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
    };

    // Fetch fresh user data on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/auth/me');
                if (res.data.success && token) {
                    dispatch(loginSuccess({ user: res.data.data, token }));
                    setFirstName(res.data.data.firstName || '');
                    setLastName(res.data.data.lastName || '');
                }
            } catch {
                // silently fail
            }
        };
        fetchProfile();
    }, []);

    const initials = `${(user?.firstName?.[0] || '').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}` || '?';

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');
        setProfileLoading(true);

        try {
            const res = await api.patch('/auth/profile', { firstName, lastName });
            if (res.data.success && token) {
                dispatch(loginSuccess({ user: res.data.data, token }));
                setProfileSuccess('Profile updated successfully!');
                setTimeout(() => setProfileSuccess(''), 3000);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setProfileError(axiosErr.response?.data?.error || 'Failed to update profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        setPasswordLoading(true);

        try {
            const res = await api.put('/auth/change-password', { currentPassword, newPassword });
            if (res.data.success) {
                setPasswordSuccess('Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setPasswordSuccess(''), 3000);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setPasswordError(axiosErr.response?.data?.error || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Page header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold">
                    <span className="gradient-text">Profile</span>
                </h1>
                <p className="text-surface-500 mt-1">Manage your account settings and preferences.</p>
            </div>

            {/* Profile overview card */}
            <div className="card p-6 mb-6">
                <div className="flex items-center gap-5">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20">
                        <span className="text-white text-2xl font-bold">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-semibold truncate">
                            {user?.firstName} {user?.lastName}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                            <span className="flex items-center gap-1.5 text-sm text-surface-500">
                                <Mail className="w-3.5 h-3.5" />
                                {user?.email}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-surface-500">
                                <Shield className="w-3.5 h-3.5" />
                                <span className="capitalize">{user?.role?.toLowerCase()}</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-surface-500">
                                <Calendar className="w-3.5 h-3.5" />
                                Joined {formatDate(user?.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Edit Profile Card ─── */}
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                            <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <h3 className="text-base font-semibold">Edit Profile</h3>
                    </div>

                    {profileSuccess && (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-sm flex items-center gap-2">
                            <Check className="w-4 h-4 flex-shrink-0" />
                            {profileSuccess}
                        </div>
                    )}
                    {profileError && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {profileError}
                        </div>
                    )}

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div>
                            <label className="input-label">First Name</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="input-field"
                                placeholder="Abhi"
                                required
                            />
                        </div>
                        <div>
                            <label className="input-label">Last Name</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="input-field"
                                placeholder="Patel"
                                required
                            />
                        </div>
                        <div>
                            <label className="input-label">Email</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                className="input-field opacity-60 cursor-not-allowed"
                                disabled
                            />
                            <p className="text-xs text-surface-500 mt-1">Email cannot be changed.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {profileLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>

                {/* ─── Change Password Card ─── */}
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-base font-semibold">Change Password</h3>
                    </div>

                    {passwordSuccess && (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-sm flex items-center gap-2">
                            <Check className="w-4 h-4 flex-shrink-0" />
                            {passwordSuccess}
                        </div>
                    )}
                    {passwordError && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {passwordError}
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="input-label">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="Enter current password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="input-label">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="At least 6 characters"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="input-label">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input-field"
                                placeholder="Re-enter new password"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            {passwordLoading ? 'Changing...' : 'Change Password'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Account Info Card */}
            <div className="card p-6 mt-6">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="text-base font-semibold">Account Information</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Account ID</p>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-mono truncate flex-1" title={user?.id}>{user?.id}</p>
                            <button
                                onClick={handleCopyId}
                                className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors flex-shrink-0"
                                title="Copy Account ID"
                            >
                                {idCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-surface-400" />}
                            </button>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Role</p>
                        <p className="text-sm font-medium capitalize">{user?.role?.toLowerCase()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Email</p>
                        <p className="text-sm font-medium truncate">{user?.email}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-1">Member Since</p>
                        <p className="text-sm font-medium">{formatDate(user?.createdAt)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
