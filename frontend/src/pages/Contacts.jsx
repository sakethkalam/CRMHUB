import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Plus, Search, Users, X, Mail, Phone, Building2, Calendar,
  Edit2, Link, Globe, Tag,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import TasksTab from '../components/TasksTab';

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

const TABS = ['Details', 'Tasks'];

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', account_id: null };

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

// ── Single-select account search dropdown ────────────────
const AccountSearchSelect = ({ value, onChange, accounts }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  const current = accounts.find(a => a.id === value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleFocus = () => {
    setQuery('');
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={open ? query : (current?.name || '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={handleFocus}
          placeholder="Search accounts…"
          className={inputCls + ' flex-1'}
        />
        {value && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onChange(null); }}
            title="Clear account"
            className="px-2.5 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-crmCard border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map(a => (
            <li
              key={a.id}
              onMouseDown={e => { e.preventDefault(); onChange(a.id); setOpen(false); setQuery(''); }}
              className="px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
              {a.industry && <p className="text-xs text-slate-400">{a.industry}</p>}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-crmCard border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-3 text-xs text-slate-400">
          No accounts match "{query}"
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────
const Contacts = () => {
  const [contacts, setContacts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allAccounts, setAllAccounts] = useState([]);

  // Detail drawer
  const [selected, setSelected]   = useState(null);
  const [drawerTab, setDrawerTab] = useState(0);

  // Edit drawer
  const [editContact, setEditContact] = useState(null);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData]       = useState(EMPTY_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError]   = useState('');

  // "Link Account" mini-modal (from detail view)
  const [linkOpen, setLinkOpen]     = useState(false);
  const [linkAccId, setLinkAccId]   = useState(null);
  const [linkSaving, setLinkSaving] = useState(false);

  // Fetch accounts for dropdowns
  useEffect(() => {
    api.get('/accounts?limit=200')
      .then(r => setAllAccounts(r.data))
      .catch(() => {});
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contacts/?search=${searchQuery}`);
      setContacts(res.data);
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchContacts, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keep detail drawer in sync after list refresh
  useEffect(() => {
    if (selected) {
      const updated = contacts.find(c => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [contacts]);

  // Derive linked account from allAccounts (has industry + website)
  const linkedAccount = allAccounts.find(a => a.id === selected?.account_id) ?? null;

  // --- Create ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError('');
    try {
      await api.post('/contacts/', formData);
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      fetchContacts();
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to create contact.');
    } finally {
      setCreateSaving(false);
    }
  };

  // --- Edit ---
  const openEdit = (contact) => {
    setEditContact(contact);
    setEditForm({
      first_name: contact.first_name,
      last_name:  contact.last_name,
      email:      contact.email  || '',
      phone:      contact.phone  || '',
      account_id: contact.account_id ?? null,
    });
    setEditError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await api.put(`/contacts/${editContact.id}`, editForm);
      setEditContact(null);
      if (selected?.id === editContact.id) setSelected(updated.data);
      fetchContacts();
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update contact.');
    } finally {
      setEditSaving(false);
    }
  };

  // --- Link / Unlink account from detail view ---
  const handleLinkAccount = async () => {
    if (!linkAccId) return;
    setLinkSaving(true);
    try {
      const res = await api.put(`/contacts/${selected.id}`, {
        first_name: selected.first_name,
        last_name:  selected.last_name,
        account_id: linkAccId,
      });
      setSelected(res.data);
      setLinkOpen(false);
      setLinkAccId(null);
      fetchContacts();
    } catch {
      // silent — keep modal open
    } finally {
      setLinkSaving(false);
    }
  };

  const handleUnlinkAccount = async () => {
    if (!window.confirm('Remove account link from this contact?')) return;
    try {
      const res = await api.put(`/contacts/${selected.id}`, {
        first_name: selected.first_name,
        last_name:  selected.last_name,
        account_id: null,
      });
      setSelected(res.data);
      fetchContacts();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="text-crmAccent w-7 h-7" /> Contacts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your individual client and prospect relationships.
          </p>
        </div>
        <button
          onClick={() => { setIsModalOpen(true); setFormData(EMPTY_FORM); setCreateError(''); }}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2 focus:ring-4 focus:ring-blue-500/20 active:scale-[0.98]"
        >
          <Plus size={18} /> Add Contact
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search contacts by name or email..."
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
                <th className="px-6 py-3.5 font-semibold">Name</th>
                <th className="px-6 py-3.5 font-semibold">Account</th>
                <th className="px-6 py-3.5 font-semibold">Email</th>
                <th className="px-6 py-3.5 font-semibold">Phone</th>
                <th className="px-6 py-3.5 font-semibold">Added On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-2 text-sm">Loading contacts...</p>
                    </div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    No contacts found. Have you added any yet?
                  </td>
                </tr>
              ) : (
                contacts.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => { setSelected(c); setDrawerTab(0); }}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${selected?.id === c.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-crmAccent dark:text-blue-400 flex items-center justify-center text-sm font-bold mr-3 shadow-inner flex-shrink-0">
                          {c.first_name.charAt(0)}{c.last_name.charAt(0)}
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.first_name} {c.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {c.account_id ? (
                        <NavLink
                          to={`/accounts`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-crmAccent hover:text-crmHover transition-colors text-sm font-medium"
                          title={`Go to ${c.account_name}`}
                        >
                          <Building2 size={13} />
                          <span className="max-w-[140px] truncate">{c.account_name}</span>
                        </NavLink>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.email ? (
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone size={15} className="text-slate-400" />
                          {c.phone}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-500 text-xs font-medium">
                      {new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
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

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-crmAccent/10 text-crmAccent flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {selected.first_name.charAt(0)}{selected.last_name.charAt(0)}
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white truncate">
                  {selected.first_name} {selected.last_name}
                </h2>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(selected)}
                  title="Edit contact"
                  className="p-1.5 text-slate-400 hover:text-crmAccent hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {drawerTab === 0 ? (
                <div className="space-y-0.5">
                  <DetailRow icon={Mail}     label="Email"   value={selected.email} />
                  <DetailRow icon={Phone}    label="Phone"   value={selected.phone} />
                  <DetailRow icon={Calendar} label="Created" value={new Date(selected.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />

                  {/* Account card */}
                  <div className="pt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Building2 size={12} /> Account
                    </p>
                    {linkedAccount ? (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <NavLink
                            to="/accounts"
                            className="text-sm font-semibold text-crmAccent hover:text-crmHover transition-colors flex items-center gap-1.5 min-w-0"
                          >
                            <Building2 size={14} />
                            <span className="truncate">{linkedAccount.name}</span>
                          </NavLink>
                          <button
                            onClick={handleUnlinkAccount}
                            title="Unlink account"
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {linkedAccount.industry && (
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Tag size={11} /> {linkedAccount.industry}
                          </p>
                        )}
                        {linkedAccount.website && (
                          <a
                            href={linkedAccount.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-crmAccent hover:text-crmHover flex items-center gap-1.5 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <Globe size={11} /> {linkedAccount.website}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">No account linked</p>
                        <button
                          onClick={() => { setLinkAccId(null); setLinkOpen(true); }}
                          className="flex items-center gap-1 text-xs font-semibold text-crmAccent hover:text-crmHover transition-colors"
                        >
                          <Link size={12} /> Link Account
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <TasksTab relatedContactId={selected.id} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Edit Drawer ───────────────────────────────────── */}
      {editContact && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setEditContact(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <h2 className="font-bold text-slate-900 dark:text-white">Edit Contact</h2>
              <button onClick={() => setEditContact(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-5 space-y-4">
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{editError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className={inputCls} placeholder="jane.doe@example.com" />
              </div>
              <div>
                <label className={labelCls}>Direct Phone</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={inputCls} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className={labelCls}>Account</label>
                <AccountSearchSelect
                  value={editForm.account_id}
                  onChange={v => setEditForm({...editForm, account_id: v})}
                  accounts={allAccounts}
                />
                <p className="text-xs text-slate-400 mt-1">Clear to unlink this contact from its account.</p>
              </div>
            </form>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0 flex gap-3 justify-end">
              <button type="button" onClick={() => setEditContact(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={editSaving}
                className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98] disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Link Account mini-modal ───────────────────────── */}
      {linkOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setLinkOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Link Account</h2>
              <button onClick={() => setLinkOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <AccountSearchSelect
                value={linkAccId}
                onChange={setLinkAccId}
                accounts={allAccounts}
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setLinkOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleLinkAccount}
                  disabled={!linkAccId || linkSaving}
                  className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {linkSaving ? 'Linking…' : 'Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Individual Contact</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{createError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputCls} placeholder="jane.doe@example.com" />
              </div>
              <div>
                <label className={labelCls}>Direct Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputCls} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className={labelCls}>Account <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
                <AccountSearchSelect
                  value={formData.account_id}
                  onChange={v => setFormData({...formData, account_id: v})}
                  accounts={allAccounts}
                />
              </div>
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={createSaving} className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98] disabled:opacity-60">
                  {createSaving ? 'Saving…' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
