import { useState, useEffect } from 'react';
import { Plus, Search, Building2, X, Globe, Tag, User, Calendar } from 'lucide-react';
import { api } from '../context/AuthContext';
import TasksTab from '../components/TasksTab';

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

const TABS = ['Details', 'Tasks'];

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

const Accounts = () => {
  const [accounts, setAccounts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer
  const [selected, setSelected]   = useState(null);
  const [drawerTab, setDrawerTab] = useState(0);

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData]       = useState({ name: '', industry: '', website: '' });

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-2 text-sm">Loading accounts...</p>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
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
              {drawerTab === 0 ? (
                <div className="space-y-0.5">
                  <DetailRow icon={Tag}      label="Industry" value={selected.industry} />
                  <DetailRow icon={Globe}    label="Website"  value={selected.website} />
                  <DetailRow icon={Building2} label="Region"  value={selected.region} />
                  <DetailRow icon={User}     label="Owner ID" value={selected.owner_id ? `#${selected.owner_id}` : null} />
                  <DetailRow icon={Calendar} label="Created"  value={new Date(selected.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
                </div>
              ) : (
                <TasksTab relatedAccountId={selected.id} />
              )}
            </div>
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
    </div>
  );
};

export default Accounts;
