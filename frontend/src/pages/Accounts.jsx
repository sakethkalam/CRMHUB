import { useState, useEffect, useContext } from 'react';
import { Plus, Search, Building2, X, Globe, Tag, User, Calendar, Users, Mail, Phone, Link, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { api, AuthContext } from '../context/AuthContext';
import TasksTab from '../components/TasksTab';

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

const TABS = ['Details', 'Contacts', 'Tasks'];

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <Icon size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
        {value || <span className="text-slate-400 font-normal">—</span>}
      </p>
    </div>
  </div>
);

// ── Toast ────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-sm animate-in slide-in-from-bottom-2 ${styles[type] || styles.success}`}>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100"><X size={15} /></button>
    </div>
  );
};

// ── Contacts tab for an account ──────────────────────────
const AccountContactsTab = ({ account }) => {
  const [contacts, setContacts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError]   = useState('');

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/contacts/?account_id=${account.id}&limit=100`);
      setContacts(res.data);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, [account.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      await api.post('/contacts/', { ...addForm, account_id: account.id });
      setAddOpen(false);
      setAddForm({ first_name: '', last_name: '', email: '', phone: '' });
      fetchContacts();
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Failed to add contact.');
    } finally {
      setAddSaving(false);
    }
  };

  const handleUnlink = async (contact) => {
    if (!window.confirm(`Remove ${contact.first_name} ${contact.last_name} from this account?`)) return;
    try {
      await api.put(`/contacts/${contact.id}`, {
        first_name: contact.first_name,
        last_name:  contact.last_name,
        account_id: null,
      });
      fetchContacts();
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {contacts.length} Contact{contacts.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => { setAddOpen(true); setAddForm({ first_name: '', last_name: '', email: '', phone: '' }); setAddError(''); }}
          className="flex items-center gap-1 text-xs font-semibold text-crmAccent hover:text-crmHover transition-colors"
        >
          <Plus size={13} /> Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center">
          <Users size={20} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">No contacts linked to this account.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {contacts.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group"
            >
              <div className="h-7 w-7 rounded-full bg-crmAccent/10 text-crmAccent flex items-center justify-center text-xs font-bold flex-shrink-0">
                {c.first_name.charAt(0)}{c.last_name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {c.first_name} {c.last_name}
                </p>
                <div className="flex flex-wrap gap-x-3 mt-0.5">
                  {c.email && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                      <Mail size={10} /> {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone size={10} /> {c.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleUnlink(c)}
                title="Unlink contact from account"
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
              >
                <Link size={13} className="rotate-45" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-crmCard p-4 space-y-3 shadow-sm">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">New Contact</p>
          {addError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">{addError}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">First Name *</label>
              <input required type="text" value={addForm.first_name} onChange={e => setAddForm({...addForm, first_name: e.target.value})} className={inputCls + ' text-xs py-2'} placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Last Name *</label>
              <input required type="text" value={addForm.last_name} onChange={e => setAddForm({...addForm, last_name: e.target.value})} className={inputCls + ' text-xs py-2'} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email</label>
            <input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} className={inputCls + ' text-xs py-2'} placeholder="jane@company.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Phone</label>
            <input type="tel" value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} className={inputCls + ' text-xs py-2'} placeholder="+1 555 0100" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={!addForm.first_name || !addForm.last_name || addSaving} className="px-4 py-1.5 bg-crmAccent hover:bg-crmHover text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              {addSaving ? 'Adding…' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────
const Accounts = () => {
  const { user } = useContext(AuthContext);
  const canDelete = user?.role === 'Admin' || user?.role === 'Manager';

  const [accounts, setAccounts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer
  const [selected, setSelected]   = useState(null);
  const [drawerTab, setDrawerTab] = useState(0);

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData]       = useState({ name: '', industry: '', website: '' });

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  // Delete dialog state
  // type: 'confirm' | 'blocked_opps' | 'warn_contacts'
  const [deleteDialog, setDeleteDialog] = useState(null);
  // deleteDialog = { type, account, openOppsCount?, contactsCount?, activitiesCount? }

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/accounts/?search=${searchQuery}`);
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchAccounts, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keep drawer in sync after refresh
  useEffect(() => {
    if (selected) {
      const updated = accounts.find(a => a.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [accounts]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts/', formData);
      setIsModalOpen(false);
      setFormData({ name: '', industry: '', website: '' });
      fetchAccounts();
    } catch (err) {
      console.error('Failed to create account', err);
    }
  };

  // ── Delete flow ────────────────────────────────────────

  // Step 1: User clicks trash → show simple confirmation first
  const initiateDelete = (e, acc) => {
    e.stopPropagation(); // don't open the drawer
    setDeleteDialog({ type: 'confirm', account: acc });
  };

  // Step 2: After user confirms the simple dialog, call DELETE ?force=false
  const executeDelete = async (force = false) => {
    const { account } = deleteDialog;
    setDeleteDialog(null);
    try {
      await api.delete(`/accounts/${account.id}?force=${force}`);
      // Success — remove from list
      setAccounts(prev => prev.filter(a => a.id !== account.id));
      if (selected?.id === account.id) setSelected(null);
      showToast(`Account '${account.name}' has been deleted.`);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data) {
        const detail = typeof data.detail === 'object' ? data.detail : data;
        if (detail.open_opportunities) {
          setDeleteDialog({ type: 'blocked_opps', account, openOppsCount: detail.open_opportunities });
        } else if (detail.contacts_count) {
          setDeleteDialog({ type: 'warn_contacts', account, contactsCount: detail.contacts_count });
        } else {
          showToast(detail.detail || 'Cannot delete account.', 'error');
        }
      } else {
        showToast(err.response?.data?.detail || 'Failed to delete account.', 'error');
      }
    }
  };

  // Called from the simple "Delete?" confirm dialog
  const onConfirmDelete = () => executeDelete(false);

  // Called from warn_contacts dialog after user clicks "Yes, Delete Account"
  const onForceDelete = () => {
    const { account } = deleteDialog;
    setDeleteDialog(null);
    // Re-run with force=true
    api.delete(`/accounts/${account.id}?force=true`)
      .then(() => {
        setAccounts(prev => prev.filter(a => a.id !== account.id));
        if (selected?.id === account.id) setSelected(null);
        showToast(`Account '${account.name}' has been deleted.`);
      })
      .catch(err => {
        showToast(err.response?.data?.detail || 'Failed to delete account.', 'error');
      });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Building2 className="text-crmAccent w-7 h-7" /> Accounts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your organizations and company relationships.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus size={18} /> New Account
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search accounts by name or industry..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Company Name</th>
                <th className="px-6 py-3.5 font-semibold">Industry</th>
                <th className="px-6 py-3.5 font-semibold">Website</th>
                <th className="px-6 py-3.5 font-semibold">Region</th>
                <th className="px-6 py-3.5 font-semibold">Created On</th>
                {canDelete && <th className="px-4 py-3.5 font-semibold w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-2 text-sm">Loading accounts...</p>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                    No accounts found matching your search.
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr
                    key={acc.id}
                    onClick={() => { setSelected(acc); setDrawerTab(0); }}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${selected?.id === acc.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{acc.name}</td>
                    <td className="px-6 py-4">
                      {acc.industry ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                          {acc.industry}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-crmAccent hover:text-crmHover transition-colors">
                      {acc.website || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {acc.region || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {new Date(acc.created_at).toLocaleDateString()}
                    </td>
                    {canDelete && (
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => initiateDelete(e, acc)}
                          title="Delete account"
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Drawer ─────────────────────────────────── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSelected(null)}
          />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

            {/* Drawer header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-crmAccent/10 text-crmAccent flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white truncate">{selected.name}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(i)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    drawerTab === i
                      ? 'text-crmAccent border-b-2 border-crmAccent'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-5">
              {drawerTab === 0 && (
                <div className="space-y-0.5">
                  <DetailRow icon={Tag}       label="Industry" value={selected.industry} />
                  <DetailRow icon={Globe}     label="Website"  value={selected.website} />
                  <DetailRow icon={Building2} label="Region"   value={selected.region} />
                  <DetailRow icon={User}      label="Owner ID" value={selected.owner_id ? `#${selected.owner_id}` : null} />
                  <DetailRow icon={Calendar}  label="Created"  value={new Date(selected.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
                </div>
              )}
              {drawerTab === 1 && (
                <AccountContactsTab account={selected} />
              )}
              {drawerTab === 2 && (
                <TasksTab relatedAccountId={selected.id} />
              )}
            </div>

            {/* Drawer footer — Delete button (role-gated) */}
            {canDelete && (
              <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <button
                  onClick={e => initiateDelete(e, selected)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={15} /> Delete Account
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Create Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Account</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Company Name <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputCls} placeholder="e.g. Acme Corporation" />
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <input type="text" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} className={inputCls} placeholder="e.g. Healthcare, SaaS" />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className={inputCls} placeholder="https://acme.com" />
              </div>
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Dialogs ────────────────────────────────── */}

      {/* 1. Simple confirmation (shown before any API call) */}
      {deleteDialog?.type === 'confirm' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteDialog(null)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete &lsquo;{deleteDialog.account.name}&rsquo;?
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    This action cannot be undone. Related activities will also be deleted.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setDeleteDialog(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Blocked — open opportunities (hard block, no delete option) */}
      {deleteDialog?.type === 'blocked_opps' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteDialog(null)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Cannot Delete Account</h3>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    This account has{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {deleteDialog.openOppsCount} open {deleteDialog.openOppsCount === 1 ? 'opportunity' : 'opportunities'}
                    </span>. Close or reassign all open opportunities before deleting.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end px-6 pb-5">
              <button
                onClick={() => setDeleteDialog(null)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Warning — has contacts (soft block, can force) */}
      {deleteDialog?.type === 'warn_contacts' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteDialog(null)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Account Has Linked Contacts</h3>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    Deleting &lsquo;{deleteDialog.account.name}&rsquo; will unlink{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {deleteDialog.contactsCount} {deleteDialog.contactsCount === 1 ? 'contact' : 'contacts'}
                    </span>. They will not be deleted but will no longer be associated with this account.
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">Do you want to continue?</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setDeleteDialog(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onForceDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Accounts;
