import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, UserPlus, X, ArrowRightCircle, Trash2, CheckCircle2,
  Phone, Mail, Building2, Briefcase, Tag, Calendar, User, ChevronRight,
  Package,
} from 'lucide-react';
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

const REG_STATUS_STYLES = {
  'Approved':        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  'Pending':         'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400',
  'Discontinued':    'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400',
  'Investigational': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  company_name: '', job_title: '', lead_source: 'Web',
  status: 'New', notes: '',
  selProducts: [],
  selAccounts: [],
};

const EMPTY_CONVERT = {
  account_name: '', contact_first_name: '', contact_last_name: '',
  opportunity_name: '', opportunity_amount: '', opportunity_expected_close_date: '',
};

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

// ── Toast ────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border transition-all animate-in slide-in-from-bottom-4 duration-300 ${
      isError
        ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
        : 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
    }`}>
      {isError ? <X size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
};

// ── Detail row helper ────────────────────────────────────
const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <Icon size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
        {value || <span className="text-slate-400 font-normal">—</span>}
      </p>
    </div>
  </div>
);

// ── Products multi-select ────────────────────────────────
const ProductMultiSelect = ({ selected, onChange, products }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p =>
    !selected.find(s => s.id === p.id) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) ||
     (p.sku || '').toLowerCase().includes(query.toLowerCase()))
  );

  const remove = (id) => onChange(selected.filter(s => s.id !== id));

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-crmAccent cursor-text transition-all"
        onClick={() => setOpen(true)}
      >
        {selected.map(p => (
          <span key={p.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
            {p.name}{p.unit_price != null ? ` · $${Number(p.unit_price).toLocaleString()}` : ''}
            <button type="button" onMouseDown={e => { e.preventDefault(); remove(p.id); }} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors">
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Search by name or SKU…' : ''}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-crmCard border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={e => { e.preventDefault(); onChange([...selected, p]); setQuery(''); }}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</p>
                {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
              </div>
              {p.unit_price != null && (
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">
                  ${Number(p.unit_price).toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Accounts multi-select (flat — no primary) ────────────
const AccountMultiSelect = ({ selected, onChange, accounts }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = accounts.filter(a =>
    !selected.find(s => s.id === a.id) &&
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const remove = (id) => onChange(selected.filter(s => s.id !== id));

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-crmAccent cursor-text transition-all"
        onClick={() => setOpen(true)}
      >
        {selected.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            <Building2 size={11} className="text-slate-400" />
            {a.name}
            <button type="button" onMouseDown={e => { e.preventDefault(); remove(a.id); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Search accounts…' : ''}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-crmCard border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map(a => (
            <li
              key={a.id}
              onMouseDown={e => { e.preventDefault(); onChange([...selected, a]); setQuery(''); }}
              className="px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
              {a.industry && <p className="text-xs text-slate-400">{a.industry}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────
const Leads = () => {
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [sourceFilter, setSource]   = useState('');

  // Detail drawer
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  // Convert modal
  const [convertLead, setConvertLead]     = useState(null);
  const [convertForm, setConvertForm]     = useState(EMPTY_CONVERT);
  const [converting, setConverting]       = useState(false);
  const [convertResult, setConvertResult] = useState(null);
  const [convertError, setConvertError]   = useState('');

  // Lookup data
  const [productSummary, setProductSummary] = useState([]);
  const [allAccounts, setAllAccounts]       = useState([]);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch lookup data on mount
  useEffect(() => {
    api.get('/products/summary?is_active=true')
      .then(r => setProductSummary(r.data))
      .catch(() => {});
    api.get('/accounts?limit=200')
      .then(r => setAllAccounts(r.data))
      .catch(() => {});
  }, []);

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

  // Client-side search
  const visible = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
      (l.company_name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    );
  });

  // Open detail: show list data immediately, then hydrate with full detail
  const openLead = async (lead) => {
    setSelectedLead(lead);
    setDetailLoading(true);
    try {
      const res = await api.get(`/leads/${lead.id}`);
      setSelectedLead(res.data);
    } catch {
      // keep list data
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Create ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const { selProducts, selAccounts, ...fields } = formData;
      const payload = {
        ...fields,
        product_ids: selProducts.map(p => p.id),
        account_ids: selAccounts.map(a => a.id),
      };
      await api.post('/leads/', payload);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      fetchLeads();
      showToast('Lead created successfully.');
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create lead.');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (lead, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete ${lead.first_name} ${lead.last_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/leads/${lead.id}`);
      if (selectedLead?.id === lead.id) setSelectedLead(null);
      fetchLeads();
      showToast('Lead deleted.');
    } catch {
      showToast('Failed to delete lead.', 'error');
    }
  };

  // --- Convert ---
  const openConvert = (lead, e) => {
    e?.stopPropagation();
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
      showToast(`${convertLead.first_name} ${convertLead.last_name} converted successfully!`);
    } catch (err) {
      setConvertError(err.response?.data?.detail || 'Conversion failed.');
    } finally {
      setConverting(false);
    }
  };

  const closeConvert = () => { setConvertLead(null); setConvertResult(null); setConvertError(''); };

  return (
    <div className="space-y-6">

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

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
          onClick={() => { setCreateOpen(true); setFormError(''); setFormData(EMPTY_FORM); }}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus size={18} /> New Lead
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 transition-colors">
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
                <th className="px-6 py-3.5 font-semibold">Products</th>
                <th className="px-6 py-3.5 font-semibold">Accounts</th>
                <th className="px-6 py-3.5 font-semibold">Owner</th>
                <th className="px-6 py-3.5 font-semibold">Created</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading leads...</p>
                    </div>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-400 text-sm">
                    No leads found. Create your first lead to get started.
                  </td>
                </tr>
              ) : (
                visible.map(lead => {
                  const prods = lead.products || [];
                  const accs  = lead.accounts  || [];
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer ${selectedLead?.id === lead.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''} ${lead.is_converted ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          {lead.first_name} {lead.last_name}
                          <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
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
                      {/* Products column */}
                      <td className="px-6 py-4">
                        {prods.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate max-w-[110px]">
                              {prods[0].name}
                            </span>
                            {prods.length > 1 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                                +{prods.length - 1} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Accounts column */}
                      <td className="px-6 py-4">
                        {accs.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate max-w-[110px]">
                              {accs[0].name}
                            </span>
                            {accs.length > 1 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                +{accs.length - 1} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        {lead.owner?.full_name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {!lead.is_converted && (
                            <button
                              onClick={(e) => openConvert(lead, e)}
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
                            onClick={(e) => handleDelete(lead, e)}
                            title="Delete lead"
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────── */}
      {selectedLead && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSelectedLead(null)}
          />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-crmAccent/10 text-crmAccent flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {selectedLead.first_name[0]}{selectedLead.last_name[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white truncate">
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedLead.status] || ''}`}>
                    {selectedLead.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">
              {detailLoading && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <DetailRow icon={Briefcase} label="Job Title"   value={selectedLead.job_title} />
              <DetailRow icon={Building2} label="Company"     value={selectedLead.company_name} />
              <DetailRow icon={Mail}      label="Email"       value={selectedLead.email} />
              <DetailRow icon={Phone}     label="Phone"       value={selectedLead.phone} />
              <DetailRow icon={Tag}       label="Lead Source" value={selectedLead.lead_source} />
              <DetailRow icon={User}      label="Owner"       value={selectedLead.owner?.full_name} />
              <DetailRow icon={Calendar}  label="Created"     value={new Date(selectedLead.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />

              {selectedLead.notes && (
                <div className="pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                    {selectedLead.notes}
                  </p>
                </div>
              )}

              {/* ── Products of Interest ── */}
              {(selectedLead.products?.length > 0 || !detailLoading) && (
                <div className="pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Package size={12} /> Products of Interest
                  </p>
                  {!selectedLead.products || selectedLead.products.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No products linked.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedLead.products.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Package size={13} className="text-blue-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.sku || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {p.unit_price != null && (
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                ${Number(p.unit_price).toLocaleString()}
                              </span>
                            )}
                            {p.regulatory_status && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${REG_STATUS_STYLES[p.regulatory_status] || 'bg-slate-100 text-slate-600'}`}>
                                {p.regulatory_status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Related Accounts ── */}
              {(selectedLead.accounts?.length > 0 || !detailLoading) && (
                <div className="pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Building2 size={12} /> Related Accounts
                  </p>
                  {!selectedLead.accounts || selectedLead.accounts.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No accounts linked.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.accounts.map(a => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                        >
                          <Building2 size={11} className="text-slate-400" />
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedLead.is_converted && (
                <div className="mt-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-purple-500" />
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    Converted {selectedLead.converted_at ? `on ${new Date(selectedLead.converted_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0 flex gap-2">
              {!selectedLead.is_converted && (
                <button
                  onClick={(e) => openConvert(selectedLead, e)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <ArrowRightCircle size={16} /> Convert Lead
                </button>
              )}
              <button
                onClick={(e) => handleDelete(selectedLead, e)}
                className="px-3 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete lead"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </>
      )}

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

              {/* Products of Interest */}
              <div>
                <label className={labelCls}>Products of Interest</label>
                <ProductMultiSelect
                  selected={formData.selProducts}
                  onChange={v => setFormData({...formData, selProducts: v})}
                  products={productSummary}
                />
                <p className="text-xs text-slate-400 mt-1">Which products is this lead interested in?</p>
              </div>

              {/* Related Accounts */}
              <div>
                <label className={labelCls}>Related Accounts</label>
                <AccountMultiSelect
                  selected={formData.selAccounts}
                  onChange={v => setFormData({...formData, selAccounts: v})}
                  accounts={allAccounts}
                />
                <p className="text-xs text-slate-400 mt-1">Which accounts/organizations is this lead associated with?</p>
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

                {/* Opportunity */}
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
