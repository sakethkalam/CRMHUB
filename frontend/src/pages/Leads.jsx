import { useState, useEffect } from 'react';
import { Plus, Search, UserPlus, X, ArrowRightCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../context/AuthContext';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'];
const SOURCES  = ['Web', 'Referral', 'Cold Call', 'Email Campaign', 'Trade Show', 'Other'];

const STATUS_COLORS = {
  'New':         'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Contacted':   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Qualified':   'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Unqualified': 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'Converted':   'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  company_name: '', job_title: '', lead_source: 'Web',
  status: 'New', notes: '',
};

const EMPTY_CONVERT = {
  account_name: '', contact_first_name: '', contact_last_name: '',
  opportunity_name: '', opportunity_amount: '', opportunity_expected_close_date: '',
};

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

const Leads = () => {
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [sourceFilter, setSource]   = useState('');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  // Convert modal
  const [convertLead, setConvertLead]   = useState(null); // lead object being converted
  const [convertForm, setConvertForm]   = useState(EMPTY_CONVERT);
  const [converting, setConverting]     = useState(false);
  const [convertResult, setConvertResult] = useState(null); // success response
  const [convertError, setConvertError] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('lead_source', sourceFilter);
      const res = await api.get(`/leads/?${params}`);
      setLeads(res.data);
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [statusFilter, sourceFilter]);

  // Client-side name/company search
  const visible = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
      (l.company_name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    );
  });

  // --- Create ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/leads/', formData);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      fetchLeads();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create lead.');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await api.delete(`/leads/${id}`);
      fetchLeads();
    } catch {
      alert('Failed to delete lead.');
    }
  };

  // --- Convert ---
  const openConvert = (lead) => {
    setConvertLead(lead);
    setConvertForm({
      ...EMPTY_CONVERT,
      account_name: lead.company_name || '',
      contact_first_name: lead.first_name,
      contact_last_name: lead.last_name,
    });
    setConvertResult(null);
    setConvertError('');
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    setConverting(true);
    setConvertError('');
    try {
      const payload = {
        ...convertForm,
        opportunity_amount: parseFloat(convertForm.opportunity_amount) || 0,
        opportunity_expected_close_date: convertForm.opportunity_expected_close_date
          ? new Date(convertForm.opportunity_expected_close_date).toISOString()
          : null,
        opportunity_name: convertForm.opportunity_name || null,
      };
      const res = await api.post(`/leads/${convertLead.id}/convert`, payload);
      setConvertResult(res.data);
      fetchLeads();
    } catch (err) {
      setConvertError(err.response?.data?.detail || 'Conversion failed.');
    } finally {
      setConverting(false);
    }
  };

  const closeConvert = () => { setConvertLead(null); setConvertResult(null); setConvertError(''); };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <UserPlus className="text-crmAccent w-7 h-7" /> Leads
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Capture and qualify prospects before they enter the pipeline.
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(true); setFormError(''); }}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus size={18} /> New Lead
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 transition-colors">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search name, company, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatus('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${!statusFilter ? 'bg-crmAccent text-white border-crmAccent' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-crmAccent hover:text-crmAccent'}`}
          >
            All
          </button>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s === statusFilter ? '' : s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${statusFilter === s ? 'bg-crmAccent text-white border-crmAccent' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-crmAccent hover:text-crmAccent'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={e => setSource(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-crmAccent transition-all cursor-pointer"
        >
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Name</th>
                <th className="px-6 py-3.5 font-semibold">Company</th>
                <th className="px-6 py-3.5 font-semibold">Email</th>
                <th className="px-6 py-3.5 font-semibold">Source</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 font-semibold">Created</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading leads...</p>
                    </div>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 text-sm">
                    No leads found. Create your first lead to get started.
                  </td>
                </tr>
              ) : (
                visible.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {lead.first_name} {lead.last_name}
                      {lead.job_title && (
                        <p className="text-xs text-slate-400 font-normal mt-0.5">{lead.job_title}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {lead.company_name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {lead.email || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {lead.lead_source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status] || ''}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!lead.is_converted && (
                          <button
                            onClick={() => openConvert(lead)}
                            title="Convert lead"
                            className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                          >
                            <ArrowRightCircle size={16} />
                          </button>
                        )}
                        {lead.is_converted && (
                          <span title="Converted" className="p-1.5 text-purple-400">
                            <CheckCircle2 size={16} />
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(lead.id)}
                          title="Delete lead"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Lead</h2>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={inputCls} placeholder="Jane" />
                </div>
                <div>
                  <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={inputCls} placeholder="Doe" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputCls} placeholder="jane@company.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputCls} placeholder="+1 555 0100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Company</label>
                  <input type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className={inputCls} placeholder="Acme Corp" />
                </div>
                <div>
                  <label className={labelCls}>Job Title</label>
                  <input type="text" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} className={inputCls} placeholder="VP of Sales" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Lead Source</label>
                  <select value={formData.lead_source} onChange={e => setFormData({...formData, lead_source: e.target.value})} className={inputCls + ' cursor-pointer'}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputCls + ' cursor-pointer'}>
                    {STATUSES.filter(s => s !== 'Converted').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className={inputCls + ' resize-none'} placeholder="Any relevant context about this lead..." />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98] disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Convert Modal ─────────────────────────────────────── */}
      {convertLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeConvert} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Convert Lead</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {convertLead.first_name} {convertLead.last_name} → Account + Contact + Opportunity
                </p>
              </div>
              <button onClick={closeConvert} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>

            {convertResult ? (
              /* Success state */
              <div className="p-8 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Lead Converted!</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{convertResult.message}</p>
                </div>
                <button onClick={closeConvert} className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConvert} className="p-6 space-y-5 overflow-y-auto flex-1">
                {convertError && (
                  <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{convertError}</p>
                )}

                {/* Account */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Account</p>
                  <div>
                    <label className={labelCls}>Account Name</label>
                    <input type="text" value={convertForm.account_name} onChange={e => setConvertForm({...convertForm, account_name: e.target.value})} className={inputCls} placeholder={convertLead.company_name || `${convertLead.first_name} ${convertLead.last_name}`} />
                    <p className="text-xs text-slate-400 mt-1">If an account with this name already exists it will be reused.</p>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Contact</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>First Name</label>
                      <input type="text" value={convertForm.contact_first_name} onChange={e => setConvertForm({...convertForm, contact_first_name: e.target.value})} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Last Name</label>
                      <input type="text" value={convertForm.contact_last_name} onChange={e => setConvertForm({...convertForm, contact_last_name: e.target.value})} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Opportunity (optional) */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Opportunity <span className="text-slate-300 dark:text-slate-600 font-normal normal-case">(optional)</span></p>
                  <p className="text-xs text-slate-400 mb-3">Leave Opportunity Name blank to skip creating a deal.</p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Opportunity Name</label>
                      <input type="text" value={convertForm.opportunity_name} onChange={e => setConvertForm({...convertForm, opportunity_name: e.target.value})} className={inputCls} placeholder={`${convertLead.first_name} ${convertLead.last_name} Opportunity`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Amount ($)</label>
                        <input type="number" min="0" step="0.01" value={convertForm.opportunity_amount} onChange={e => setConvertForm({...convertForm, opportunity_amount: e.target.value})} className={inputCls} placeholder="0" />
                      </div>
                      <div>
                        <label className={labelCls}>Close Date</label>
                        <input type="date" value={convertForm.opportunity_expected_close_date} onChange={e => setConvertForm({...convertForm, opportunity_expected_close_date: e.target.value})} className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                  <button type="button" onClick={closeConvert} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={converting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-emerald-500/30 active:scale-[0.98] disabled:opacity-60 flex items-center gap-2">
                    <ArrowRightCircle size={16} />
                    {converting ? 'Converting...' : 'Convert Lead'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
