import { useState, useEffect, useCallback, useContext } from 'react';
import {
  Plus, Search, X, CheckCircle2, AlertTriangle, Check,
  UserCheck, UserX, KeyRound, ChevronDown, Mail,
} from 'lucide-react';
import { api, AuthContext } from '../../context/AuthContext';

const ROLES = ['Admin', 'Manager', 'Sales Rep', 'Read Only'];

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

// ── Shared helpers ────────────────────────────────────────────────────────────

const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border animate-in slide-in-from-bottom-4 duration-300 ${
      isError
        ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
        : 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
    }`}>
      {isError ? <X size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
    </div>
  );
};

const ROLE_COLORS = {
  'Admin':     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Manager':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Sales Rep': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Read Only': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ── Main component ────────────────────────────────────────────────────────────

const UserManagement = () => {
  const { user: me } = useContext(AuthContext);

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleF]    = useState('');
  const [statusFilter, setStatusF]= useState('');
  const [selectedIds, setSelected]= useState(new Set());
  const [savingId, setSavingId]   = useState(null);   // tracks in-flight per-row actions
  const [toast, setToast]         = useState(null);
  const [inviteOpen, setInvite]   = useState(false);
  const [inviteForm, setIForm]    = useState({ email: '', full_name: '', role: 'Sales Rep' });
  const [inviting, setInviting]   = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/admin/users?${params}`);
      setUsers(res.data);
    } catch {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 350);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const pending = users.filter(u => !u.is_approved);

  // ── Row actions ─────────────────────────────────────────────────────────────

  const action = async (userId, fn, successMsg) => {
    setSavingId(userId);
    try {
      const updated = await fn();
      setUsers(prev => prev.map(u => (u.id === userId ? updated.data : u)));
      showToast(successMsg);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleApprove = (u) =>
    action(u.id, () => api.patch(`/admin/users/${u.id}/approve`), `${u.full_name || u.email} approved.`);

  const handleRoleChange = (u, role) =>
    action(u.id, () => api.patch(`/admin/users/${u.id}/role`, { role }), `Role updated to ${role}.`);

  const handleToggleActive = (u) =>
    action(u.id, () => api.patch(`/admin/users/${u.id}/toggle-active`),
      u.is_active ? `${u.full_name || u.email} deactivated.` : `${u.full_name || u.email} reactivated.`);

  const handleResetPw = async (u) => {
    setSavingId(u.id);
    try {
      await api.post(`/admin/users/${u.id}/reset-password`);
      showToast(`Reset email sent to ${u.email}.`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to send reset email.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  const handleBulkApprove = async () => {
    try {
      const res = await api.post('/admin/users/bulk-approve', { user_ids: [...selectedIds] });
      showToast(`${res.data.approved} user(s) approved.`);
      setSelected(new Set());
      fetchUsers();
    } catch {
      showToast('Bulk approve failed.', 'error');
    }
  };

  const handleBulkDeactivate = async () => {
    if (!window.confirm(`Deactivate ${selectedIds.size} selected user(s)?`)) return;
    try {
      const res = await api.post('/admin/users/bulk-deactivate', { user_ids: [...selectedIds] });
      showToast(`${res.data.deactivated} user(s) deactivated.`);
      setSelected(new Set());
      fetchUsers();
    } catch {
      showToast('Bulk deactivate failed.', 'error');
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (selectedIds.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(u => u.id)));
    }
  };

  // ── Invite modal ─────────────────────────────────────────────────────────────

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await api.post('/admin/users/invite', inviteForm);
      setUsers(prev => [res.data, ...prev]);
      showToast(`Invitation sent to ${inviteForm.email}.`);
      setInvite(false);
      setIForm({ email: '', full_name: '', role: 'Sales Rep' });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Invite failed.', 'error');
    } finally {
      setInviting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pending approvals banner */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 mb-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span><strong>{pending.length}</strong> user{pending.length > 1 ? 's' : ''} awaiting approval</span>
          </div>
          <button
            onClick={async () => {
              const ids = pending.map(u => u.id);
              try {
                const res = await api.post('/admin/users/bulk-approve', { user_ids: ids });
                showToast(`${res.data.approved} user(s) approved.`);
                fetchUsers();
              } catch {
                showToast('Failed to approve all.', 'error');
              }
            }}
            className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Approve All
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 transition-all"
          />
        </div>

        {/* Role filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={e => setRoleF(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusF(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex-1" />

        {/* Bulk action buttons (only when rows are selected) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkApprove}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              Approve Selected
            </button>
            <button
              onClick={handleBulkDeactivate}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Deactivate Selected
            </button>
          </div>
        )}

        {/* Invite button */}
        <button
          onClick={() => setInvite(true)}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={16} /> Invite User
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedIds.size === users.length}
                  onChange={toggleAll}
                  className="rounded border-slate-300 dark:border-slate-600 text-crmAccent focus:ring-crmAccent"
                />
              </th>
              <th className="px-4 py-3.5 font-semibold">Name</th>
              <th className="px-4 py-3.5 font-semibold">Email</th>
              <th className="px-4 py-3.5 font-semibold">Role</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold">Approved</th>
              <th className="px-4 py-3.5 font-semibold">Created</th>
              <th className="px-4 py-3.5 font-semibold">Last Login</th>
              <th className="px-4 py-3.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan="9" className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                    <p className="mt-2 text-sm">Loading users…</p>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-12 text-center text-slate-400 text-sm">
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              users.map(u => {
                const isSelf    = u.id === me?.id;
                const isLoading = savingId === u.id;

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      !u.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="rounded border-slate-300 dark:border-slate-600 text-crmAccent focus:ring-crmAccent"
                      />
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-crmAccent/10 text-crmAccent flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        {u.full_name || <span className="text-slate-400">—</span>}
                        {isSelf && <span className="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">You</span>}
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>

                    {/* Role — inline editable dropdown */}
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <select
                          value={u.role}
                          onChange={e => !isSelf && handleRoleChange(u, e.target.value)}
                          disabled={isSelf || isLoading}
                          className={`appearance-none text-xs font-semibold px-2.5 py-1 rounded-lg pr-6 cursor-pointer border transition-colors focus:outline-none focus:ring-2 focus:ring-crmAccent/50 disabled:cursor-default disabled:opacity-70
                            ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'} border-transparent`}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Approved badge */}
                    <td className="px-4 py-3">
                      {u.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <Check size={11} /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                          <AlertTriangle size={11} /> Pending
                        </span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-500 text-xs">{fmt(u.created_at)}</td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-500 text-xs">{fmt(u.last_login)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Approve */}
                        {!u.is_approved && (
                          <button
                            onClick={() => handleApprove(u)}
                            disabled={isLoading}
                            title="Approve"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                          >
                            <UserCheck size={15} />
                          </button>
                        )}

                        {/* Toggle active */}
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isLoading}
                            title={u.is_active ? 'Deactivate' : 'Reactivate'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                          >
                            {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        )}

                        {/* Reset password */}
                        <button
                          onClick={() => handleResetPw(u)}
                          disabled={isLoading}
                          title="Send password reset email"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-crmAccent hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                        >
                          <KeyRound size={15} />
                        </button>

                        {/* Loading spinner */}
                        {isLoading && (
                          <div className="w-4 h-4 border-2 border-crmAccent border-t-transparent rounded-full animate-spin ml-1" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Invite Modal ──────────────────────────────────────────────────────── */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInvite(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-crmAccent" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invite User</h2>
              </div>
              <button onClick={() => setInvite(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                <input
                  required type="email"
                  value={inviteForm.email}
                  onChange={e => setIForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls} placeholder="jane.doe@example.com"
                />
              </div>
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setIForm(f => ({ ...f, full_name: e.target.value }))}
                  className={inputCls} placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setIForm(f => ({ ...f, role: e.target.value }))}
                  className={inputCls + ' cursor-pointer'}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-400">An invitation email will be sent with a 72-hour activation link.</p>
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setInvite(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={inviting}
                  className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60">
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
};

export default UserManagement;
