import { useState, useContext } from 'react';
import { AuthContext, api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Mail, Lock, User, ArrowRight } from 'lucide-react';

const Login = () => {
  const { login } = useContext(AuthContext); 
  const navigate = useNavigate();
  
  // Toggle between Login and Registration views
  const [isLoginView, setIsLoginView] = useState(true);
  const [errorStatus, setErrorStatus] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorStatus('');
    setIsLoading(true);
    
    try {
      if (isLoginView) {
        await login(email, password); // throws on any failure — catch block below handles it
        navigate('/');               // only reached on success
      } else {
        await api.post('/users/register', {
          email, password, full_name: fullName,
        });
        // Account requires admin approval — don't auto-login
        setRegisterSuccess(true);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'pending_approval') {
        setPendingApproval(true);
      } else {
        // detail can be an array (Pydantic validation errors) or an object — always stringify
        const message = Array.isArray(detail)
          ? detail.map(d => d.msg || JSON.stringify(d)).join(' · ')
          : (typeof detail === 'string' ? detail : null)
            || err.message
            || (isLoginView ? 'Invalid credentials' : 'Registration failed. Check your data.');
        setErrorStatus(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-crmDark flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* SHINSO Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-tr from-crmAccent to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-crmAccent/20">
            <BarChart3 size={32} strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-semibold text-[#7984EE] tracking-tight">SHINSO</span>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {isLoginView ? 'Welcome back' : 'Create an account'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          {isLoginView ? 'The Intelligent Layer for Corporate Accounts' : 'Join SHINSO and manage your pipeline'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Core Form Card */}
        <div className="bg-white dark:bg-crmCard py-8 px-4 shadow-2xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {registerSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg text-sm text-center font-medium">
                ✅ Account created! The admin has been notified and will approve your account shortly. You'll receive a confirmation email.
              </div>
            )}

            {pendingApproval && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg text-sm text-center font-medium">
                ⏳ Your account is pending admin approval. You'll receive an email once it's approved.
              </div>
            )}

            {errorStatus && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center font-medium animate-in slide-in-from-top-2">
                {errorStatus}
              </div>
            )}

            {!isLoginView && (
              <div className="animate-in slide-in-from-top-4 duration-300 fade-in">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required={!isLoginView}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-shinso-400 focus:border-shinso-400 dark:text-white transition-all shadow-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-shinso-400 focus:border-shinso-400 dark:text-white transition-all shadow-sm"
                  placeholder="you@company.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-shinso-400 focus:border-shinso-400 dark:text-white transition-all shadow-sm"
                  placeholder="••••••••••••"
                />
              </div>
              {!isLoginView && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Min 8 characters, at least 1 uppercase letter and 1 number. Example: <span className="font-mono">Crm12345</span>
                </p>
              )}
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-shinso-400 hover:bg-shinso-600 focus:outline-none focus:ring-4 focus:ring-shinso-400/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLoginView ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Toggle View */}
          <div className="mt-8 text-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {isLoginView ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              type="button"
              onClick={() => {
                setIsLoginView(!isLoginView);
                setErrorStatus('');
                setPendingApproval(false);
                setRegisterSuccess(false);
              }}
              className="text-sm font-bold text-shinso-400 hover:text-shinso-600 transition-colors focus:outline-none"
            >
              {isLoginView ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
