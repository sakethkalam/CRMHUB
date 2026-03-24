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
import Login from './pages/Login';

// --- PrivateRoute Wrapper Component ---
// This intelligently blocks access to any page that requires authentication.
const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  // If the context is still pinging FastAPI to verify the session
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-slate-50 dark:bg-crmDark">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-crmAccent border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium tracking-wide animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Everything is good, render the protected component
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
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* Catch-all Fallback (404 mapping) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
