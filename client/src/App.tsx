import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BotListPage from './pages/BotListPage';
import BotSettingsPage from './pages/BotSettingsPage';
import FlowListPage from './pages/FlowListPage';
import FlowBuilderPage from './pages/FlowBuilderPage';
import AIManagementPage from './pages/AIManagementPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import Layout from './components/Layout/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/"
                element={
                    <PrivateRoute>
                        <Layout />
                    </PrivateRoute>
                }
            >
                <Route index element={<DashboardPage />} />
                <Route path="bots" element={<BotListPage />} />
                <Route path="bots/:botId/settings" element={<BotSettingsPage />} />
                <Route path="bots/:botId/flows" element={<FlowListPage />} />
                <Route path="ai-management" element={<AIManagementPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route
                path="/builder/:botId/:flowId"
                element={
                    <PrivateRoute>
                        <FlowBuilderPage />
                    </PrivateRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default App;
