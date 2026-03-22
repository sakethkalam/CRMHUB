import { useState, useContext } from 'react';
import { AuthContext, api } from '../context/AuthContext';
import { User, Mail, Lock, Save, CheckCircle } from 'lucide-react';

const Profile = () => {
  const { user, setUser } = useContext(AuthContext);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const showSuccess = (msg) => { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg) => { setError(msg); setSuccess(''); };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/users/me', { full_name: fullName });
      setUser(res.data);
      showSuccess('Profile updated successfully');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showError('New passwords do not match'); return; }
    setSaving(true);
    try {
      await api.patch('/users/me', { current_password: currentPassword, new_password: newPassword });
      showSuccess('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="text-crmAccent w-7 h-7" /> Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your personal information and password.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm animate-in slide-in-from-top-2">
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Avatar + info header */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-crmAccent to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{user?.full_name || 'No name set'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Active Account
          </span>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <User size={16} /> Personal Information
        </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400">
              <Mail size={15} /> {user?.email}
            </div>
            <p className="text-xs text-slate-400 mt-1">Email address cannot be changed.</p>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 focus:ring-4 focus:ring-blue-500/20">
              <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Lock size={16} /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
            <p className="text-xs text-slate-400 mt-1">Min 8 characters, 1 uppercase, 1 digit.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving || !currentPassword || !newPassword} className="flex items-center gap-2 px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 focus:ring-4 focus:ring-blue-500/20">
              <Lock size={15} /> {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
