import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Contacts from './pages/Contacts';
import Opportunities from './pages/Opportunities';
import Leads from './pages/Leads';
import Tasks from './pages/Tasks';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Forecast from './pages/Forecast';
import Products from './pages/Products';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import UserManagement from './pages/admin/UserManagement';
import AuditLog from './pages/admin/AuditLog';
import SystemSettings from './pages/admin/SystemSettings';

const Spinner = () => (
  <div className="flex justify-center items-center h-screen w-full bg-slate-50 dark:bg-crmDark">
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 border-4 border-crmAccent border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-slate-500 font-medium tracking-wide animate-pulse">Authenticating...</p>
    </div>
  </div>
);

// Blocks unauthenticated access to any protected page
const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Blocks non-Admin users from the /admin subtree, redirects to dashboard
const AdminRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'Admin') return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    // Wrap the entire router tree in our AuthProvider so state cascades down
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Enterprise Routes wrapper inside our new Layout shell! */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="opportunities" element={<Opportunities />} />
            <Route path="leads" element={<Leads />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="forecast"  element={<Forecast />} />
            <Route path="products" element={<Products />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Portal — requires role = Admin */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users"     element={<UserManagement />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings"  element={<SystemSettings />} />
          </Route>

          {/* Catch-all Fallback (404 mapping) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
