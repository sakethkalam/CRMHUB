import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Layout from './components/Layout';
import Accounts from './pages/Accounts';
import Contacts from './pages/Contacts';
import Opportunities from './pages/Opportunities';

// --- Temporary Stub Components ---
// We will replace these with real beautiful UI components in Phase 4
const Login = () => <div className="flex h-screen items-center justify-center"><h1 className="text-2xl font-bold">Login Screen Placeholder</h1></div>;
const Dashboard = () => <div className="p-10"><h1 className="text-3xl font-bold">Dashboard</h1><p className="opacity-70 mt-2">Welcome to your robust React CRM.</p></div>;

// --- PrivateRoute Wrapper Component ---
// This intelligently blocks access to any page that requires authentication.
const PrivateRoute = ({ children }) => {
  const { user, loading, token } = useContext(AuthContext);

  // If the context is still pinging FastAPI to verify the JWT token
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-slate-50 dark:bg-crmDark">
        {/* Simple Tailwind loading pulse */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-crmAccent border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium tracking-wide animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  // If there's no trace of a token or user, bounce them back to the login wall
  if (!token && !user) {
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
          </Route>
          
          {/* Catch-all Fallback (404 mapping) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
