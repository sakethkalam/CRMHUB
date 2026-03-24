import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, BarChart3, Calendar, DollarSign, Building2, X,
  ChevronRight, Loader2, Edit2, Star, Package, CheckCircle2,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import TasksTab from '../components/TasksTab';

// ── Constants ──────────────────────────────────────────────
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const STAGE_COLORS = {
  'Prospecting':   'border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'Qualification': 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Proposal':      'border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  'Negotiation':   'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Closed Won':    'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Closed Lost':   'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
};

const NEXT_STAGES = {
  'Prospecting':   'Qualification',
  'Qualification': 'Proposal',
  'Proposal':      'Negotiation',
  'Negotiation':   'Closed Won',
};

const REG_STATUS_STYLES = {
  'Approved':        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700',
  'Pending':         'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-700',
  'Discontinued':    'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700',
  'Investigational': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-700',
};

const TABS = ['Details', 'Tasks'];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

// ── Toast ──────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${
      isErr
        ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
        : 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
    }`}>
      {isErr ? <X size={16} /> : <CheckCircle2 size={16} />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// ProductMultiSelect
// ══════════════════════════════════════════════════════════
const ProductMultiSelect = ({ selected, onChange, products }) => {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = products.filter(p =>
    !selected.some(s => s.id === p.id) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) ||
     (p.sku || '').toLowerCase().includes(query.toLowerCase()))
  );

  const add    = (p) => { onChange([...selected, p]); setQuery(''); setOpen(false); };
  const remove = (id) => onChange(selected.filter(p => p.id !== id));

  return (
    <div ref={ref} className="relative">
      {/* Tag input box */}
      <div
        className="min-h-[42px] w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus-within:ring-2 focus-within:ring-crmAccent transition-all flex flex-wrap gap-1.5 cursor-text"
        onClick={() => { setOpen(true); ref.current?.querySelector('input')?.focus(); }}
      >
        {selected.map(p => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5 text-xs font-medium flex-shrink-0"
          >
            <Package size={11} className="flex-shrink-0 opacity-70" />
            <span className="max-w-[180px] truncate">
              {p.name}
              {p.unit_price != null && (
                <span className="opacity-60 ml-1">
                  · {p.currency || 'USD'} {Number(p.unit_price).toLocaleString()}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(p.id); }}
              className="ml-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition-colors flex-shrink-0"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Search by name or SKU…' : ''}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm py-0.5"
        />
      </div>

      {/* Dropdown */}
      {open && (filtered.length > 0 || (query && filtered.length === 0)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[55] max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400 text-center">No products match "{query}"</p>
          ) : (
            filtered.slice(0, 25).map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); add(p); }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex items-center gap-2.5"
              >
                <Package size={14} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.sku}
                    {p.unit_price != null && ` · $${Number(p.unit_price).toLocaleString()}`}
                    {p.regulatory_status && ` · ${p.regulatory_status}`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// AccountMultiSelect  (order = primary first, star to promote)
// ══════════════════════════════════════════════════════════
const AccountMultiSelect = ({ selected, onChange, accounts }) => {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = accounts.filter(a =>
    !selected.some(s => s.id === a.id) &&
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const add    = (a)  => { onChange([...selected, a]); setQuery(''); setOpen(false); };
  const remove = (id) => onChange(selected.filter(a => a.id !== id));

  // Click a non-primary account's star → move it to index 0
  const promote = (id) => {
    const idx = selected.findIndex(a => a.id === id);
    if (idx <= 0) return;
    const next = [...selected];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[42px] w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus-within:ring-2 focus-within:ring-crmAccent transition-all flex flex-wrap gap-1.5 cursor-text"
        onClick={() => { setOpen(true); ref.current?.querySelector('input')?.focus(); }}
      >
        {selected.map((a, i) => (
          <span
            key={a.id}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border flex-shrink-0 ${
              i === 0
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {/* Star: filled = primary, outline = click to promote */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); promote(a.id); }}
              disabled={i === 0}
              title={i === 0 ? 'Primary account' : 'Make primary'}
              className={`flex-shrink-0 transition-colors ${
                i === 0
                  ? 'text-amber-500 cursor-default'
                  : 'text-slate-400 hover:text-amber-500 cursor-pointer'
              }`}
            >
              <Star size={11} fill={i === 0 ? 'currentColor' : 'none'} strokeWidth={i === 0 ? 0 : 2} />
            </button>

            <span className="max-w-[140px] truncate">{a.name}</span>

            {i === 0 && (
              <span className="text-[9px] font-bold px-1 py-px bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded uppercase tracking-wide flex-shrink-0">
                PRIMARY
              </span>
            )}

            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(a.id); }}
              className="ml-0.5 flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Search accounts…' : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm py-0.5"
        />
      </div>

      {open && (filtered.length > 0 || (query && filtered.length === 0)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[55] max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400 text-center">No accounts match "{query}"</p>
          ) : (
            filtered.slice(0, 25).map(a => (
              <button
                key={a.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); add(a); }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex items-center gap-2.5"
              >
                <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{a.name}</p>
                  {a.industry && <p className="text-xs text-slate-400">{a.industry}</p>}
                </div>
                {selected.length === 0 && (
                  <span className="text-[10px] text-slate-400 flex-shrink-0">will be primary</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// Opportunities (main page)
// ══════════════════════════════════════════════════════════
const BLANK_FORM = {
  name: '', amount: '', stage: 'Prospecting', expected_close_date: '',
  selProducts: [], selAccounts: [],
};

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [movingId,      setMovingId]      = useState(null);

  // ── Reference data ────────────────────────────────────────
  const [productSummary, setProductSummary] = useState([]);
  const [allAccounts,    setAllAccounts]    = useState([]);

  // ── Detail drawer ─────────────────────────────────────────
  const [selected,   setSelected]   = useState(null);
  const [drawerTab,  setDrawerTab]  = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Create modal ──────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createForm,  setCreateForm]  = useState(BLANK_FORM);
  const [creating,    setCreating]    = useState(false);

  // ── Edit drawer ───────────────────────────────────────────
  const [editOpp,   setEditOpp]   = useState(null); // opp being edited
  const [editForm,  setEditForm]  = useState(BLANK_FORM);
  const [saving,    setSaving]    = useState(false);

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch all opportunities ───────────────────────────────
  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/opportunities/?limit=100');
      setOpportunities(res.data);
    } catch {
      showToast('Failed to load opportunities', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch reference data on mount ─────────────────────────
  useEffect(() => {
    fetchOpportunities();
    api.get('/products/summary?is_active=true').then(r => setProductSummary(r.data)).catch(() => {});
    api.get('/accounts/?limit=200').then(r => setAllAccounts(r.data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep detail drawer in sync after list refresh ─────────
  useEffect(() => {
    if (selected) {
      const updated = opportunities.find(o => o.id === selected.id);
      if (updated) setSelected(prev => ({ ...prev, ...updated }));
    }
  }, [opportunities]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open detail drawer (fetch full detail for products/accounts) ──
  const openDrawer = async (opp) => {
    setSelected(opp);
    setDrawerTab(0);
    setDetailLoading(true);
    try {
      const res = await api.get(`/opportunities/${opp.id}`);
      setSelected(res.data);
    } catch {
      // keep the list data; products/accounts may be absent
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Open edit drawer (pre-populate form) ──────────────────
  const openEdit = (opp) => {
    // Put the primary account (matching account_id) first
    let accounts = opp.accounts ? [...opp.accounts] : [];
    if (opp.account_id && accounts.length > 0) {
      const pi = accounts.findIndex(a => a.id === opp.account_id);
      if (pi > 0) { const [p] = accounts.splice(pi, 1); accounts.unshift(p); }
    }

    setEditForm({
      name:                 opp.name || '',
      amount:               opp.amount ?? '',
      stage:                opp.stage || 'Prospecting',
      expected_close_date:  opp.expected_close_date ? opp.expected_close_date.slice(0, 10) : '',
      selProducts:          opp.products  || [],
      selAccounts:          accounts,
    });
    setEditOpp(opp);
  };

  // ── Create ────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        name:                 createForm.name,
        amount:               parseFloat(createForm.amount) || 0,
        stage:                createForm.stage,
        expected_close_date:  createForm.expected_close_date
                                ? new Date(createForm.expected_close_date).toISOString()
                                : null,
        product_ids:  createForm.selProducts.map(p => p.id),
        account_ids:  createForm.selAccounts.map(a => a.id),
      };
      await api.post('/opportunities/', payload);
      setIsModalOpen(false);
      setCreateForm(BLANK_FORM);
      showToast('Deal added to pipeline');
      fetchOpportunities();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create deal', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── Update (edit drawer) ──────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editOpp) return;
    setSaving(true);
    try {
      const payload = {
        name:                 editForm.name,
        amount:               parseFloat(editForm.amount) || 0,
        stage:                editForm.stage,
        expected_close_date:  editForm.expected_close_date
                                ? new Date(editForm.expected_close_date).toISOString()
                                : null,
        product_ids:  editForm.selProducts.map(p => p.id),
        account_ids:  editForm.selAccounts.map(a => a.id),
      };
      await api.patch(`/opportunities/${editOpp.id}`, payload);
      showToast('Deal updated');
      setEditOpp(null);
      // Refresh list and detail drawer
      await fetchOpportunities();
      if (selected?.id === editOpp.id) {
        const detail = await api.get(`/opportunities/${editOpp.id}`);
        setSelected(detail.data);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update deal', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Move stage ────────────────────────────────────────────
  const handleMoveStage = async (opp, newStage) => {
    setMovingId(opp.id);
    try {
      const res = await api.patch(`/opportunities/${opp.id}/stage`, { stage: newStage });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, ...res.data } : o));
      if (selected?.id === opp.id) setSelected(prev => ({ ...prev, ...res.data }));
    } catch {
      showToast('Failed to move stage', 'error');
    } finally {
      setMovingId(null);
    }
  };

  const getOppsByStage = (stage) => opportunities.filter(o => o.stage === stage);

  // ── helper: set create form field ─────────────────────────
  const setC = (k, v) => setCreateForm(p => ({ ...p, [k]: v }));
  const setE = (k, v) => setEditForm(p => ({ ...p, [k]: v }));

  // ══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <BarChart3 className="text-crmAccent w-7 h-7" /> Sales Pipeline
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and visually manage your opportunities progressing through the organization funnel.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2 focus:ring-4 focus:ring-blue-500/20 active:scale-[0.98]"
        >
          <Plus size={18} /> New Deal
        </button>
      </div>

      {/* ── Kanban ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto pb-4">
        {loading ? (
          <div className="flex justify-center items-center h-64 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-crmAccent border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-slate-500 font-medium tracking-wide">Rendering pipeline...</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max items-start">
            {STAGES.map(stage => {
              const stageOpps  = getOppsByStage(stage);
              const colorClass = STAGE_COLORS[stage];
              const totalValue = stageOpps.reduce((s, o) => s + (o.amount || 0), 0);

              return (
                <div key={stage} className="w-[320px] flex-shrink-0 flex flex-col bg-slate-100/60 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <div className={`p-4 border-b-[3px] rounded-t-xl ${colorClass.split(' ')[0]} bg-white dark:bg-crmCard sticky top-0 z-10 shadow-sm flex justify-between items-center`}>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wide">{stage}</h3>
                      <p className="text-xs font-semibold mt-1 text-slate-500 dark:text-slate-400">
                        {stageOpps.length} {stageOpps.length === 1 ? 'deal' : 'deals'}
                        <span className="mx-1.5 opacity-50">•</span>
                        <span className="text-slate-700 dark:text-slate-300">{fmt(totalValue)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[500px]">
                    {stageOpps.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/20">
                        <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">Empty Stage</p>
                      </div>
                    ) : (
                      stageOpps.map(opp => {
                        const nextStage = NEXT_STAGES[opp.stage];
                        const isMoving  = movingId === opp.id;
                        const primaryAcc = opp.accounts?.[0] || null;
                        return (
                          <div
                            key={opp.id}
                            onClick={() => openDrawer(opp)}
                            className={`bg-white dark:bg-crmCard p-4 rounded-xl shadow-sm hover:shadow-md border transition-all cursor-pointer group hover:-translate-y-0.5 ${
                              selected?.id === opp.id
                                ? 'border-crmAccent ring-1 ring-crmAccent/30'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight pr-2">
                                {opp.name}
                              </h4>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center text-[13px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/40">
                                {fmt(opp.amount)}
                              </div>
                              <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                                  <Building2 size={13} className="mr-1.5 opacity-70 flex-shrink-0" />
                                  <span className="truncate">
                                    {primaryAcc ? primaryAcc.name : (opp.account_id ? `Account #${opp.account_id}` : 'Unassigned')}
                                  </span>
                                </div>
                                {opp.expected_close_date && (
                                  <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                                    <Calendar size={13} className="mr-1.5 opacity-70" />
                                    Close: {new Date(opp.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                                {opp.products?.length > 0 && (
                                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                    <Package size={13} className="mr-1.5 opacity-70" />
                                    {opp.products.length} product{opp.products.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                              {nextStage && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleMoveStage(opp, nextStage); }}
                                  disabled={isMoving}
                                  className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-crmAccent hover:text-white hover:border-crmAccent dark:hover:bg-crmAccent dark:hover:border-crmAccent transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                >
                                  {isMoving
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <><span>Move to {nextStage}</span><ChevronRight size={12} /></>}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          DETAIL DRAWER
      ════════════════════════════════════════════════════ */}
      {selected && (
        <>
          <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

            {/* Drawer header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white truncate text-sm">{selected.name}</h2>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-block mt-0.5 ${STAGE_COLORS[selected.stage] || ''}`}>
                    {selected.stage}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => openEdit(selected)}
                  className="p-1.5 text-slate-400 hover:text-crmAccent hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  title="Edit deal"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
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
              {detailLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-crmAccent" />
                </div>
              )}

              {drawerTab === 0 ? (
                <div className="space-y-0.5">
                  {/* Stage selector */}
                  <div className="py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400 mb-1.5">Stage</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={selected.stage}
                        onChange={e => handleMoveStage(selected, e.target.value)}
                        disabled={movingId === selected.id}
                        className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-crmAccent cursor-pointer disabled:opacity-60"
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {movingId === selected.id && <Loader2 size={16} className="animate-spin text-crmAccent flex-shrink-0" />}
                    </div>
                  </div>

                  {/* Core fields */}
                  {[
                    { label: 'Amount',         value: fmt(selected.amount || 0) },
                    { label: 'Probability',    value: selected.probability != null ? `${selected.probability}%` : null },
                    { label: 'Forecast',       value: selected.forecast_category },
                    { label: 'Close Reason',   value: selected.close_reason },
                    { label: 'Expected Close', value: selected.expected_close_date ? new Date(selected.expected_close_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null },
                    { label: 'Created',        value: new Date(selected.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {value || <span className="text-slate-400 font-normal">—</span>}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* ── Accounts section ──────────────────── */}
                  {!detailLoading && (
                    <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400 mb-2">
                        Accounts
                        {selected.accounts?.length > 0 && <span className="ml-1 text-slate-300">({selected.accounts.length})</span>}
                      </p>
                      {selected.accounts?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.accounts.map((a, i) => (
                            <span
                              key={a.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                i === 0
                                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {i === 0 && <Star size={10} fill="currentColor" className="text-amber-500 flex-shrink-0" strokeWidth={0} />}
                              <Building2 size={11} className={i === 0 ? 'text-amber-500' : 'text-slate-400'} />
                              <span className="max-w-[120px] truncate">{a.name}</span>
                              {i === 0 && (
                                <span className="text-[9px] font-bold px-1 py-px bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded uppercase tracking-wide">
                                  PRIMARY
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No accounts linked</p>
                      )}
                    </div>
                  )}

                  {/* ── Products section ──────────────────── */}
                  {!detailLoading && (
                    <div className="py-3">
                      <p className="text-xs text-slate-400 mb-2">
                        Products
                        {selected.products?.length > 0 && <span className="ml-1 text-slate-300">({selected.products.length})</span>}
                      </p>
                      {selected.products?.length > 0 ? (
                        <div className="space-y-2">
                          {selected.products.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                              <Package size={14} className="text-crmAccent flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                                {p.sku && <p className="text-[11px] text-slate-400 font-mono">{p.sku}</p>}
                              </div>
                              {p.unit_price != null && (
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex-shrink-0">
                                  {p.currency || 'USD'} {Number(p.unit_price).toLocaleString()}
                                </span>
                              )}
                              {p.regulatory_status && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${REG_STATUS_STYLES[p.regulatory_status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                  {p.regulatory_status}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No products linked</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <TasksTab relatedOpportunityId={selected.id} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          CREATE MODAL
      ════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 rounded-t-2xl flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Deal</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Deal name */}
                <div>
                  <label className={labelCls}>Deal Name <span className="text-red-500">*</span></label>
                  <input
                    required type="text"
                    value={createForm.name}
                    onChange={e => setC('name', e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Acme Backend Expansion"
                  />
                </div>

                {/* Amount + Close date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Est. Value ($)</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number" min="0" step="0.01"
                        value={createForm.amount}
                        onChange={e => setC('amount', e.target.value)}
                        className={`${inputCls} pl-9`}
                        placeholder="120000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Close Target</label>
                    <input
                      type="date"
                      value={createForm.expected_close_date}
                      onChange={e => setC('expected_close_date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Stage */}
                <div>
                  <label className={labelCls}>Pipeline Stage</label>
                  <select
                    value={createForm.stage}
                    onChange={e => setC('stage', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all cursor-pointer"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Products */}
                <div>
                  <label className={labelCls}>Products</label>
                  <ProductMultiSelect
                    selected={createForm.selProducts}
                    onChange={v => setC('selProducts', v)}
                    products={productSummary}
                  />
                </div>

                {/* Accounts */}
                <div>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Related Accounts</label>
                    <span className="text-xs text-slate-400">(first selected = primary account)</span>
                  </div>
                  <AccountMultiSelect
                    selected={createForm.selAccounts}
                    onChange={v => setC('selAccounts', v)}
                    accounts={allAccounts}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-crmAccent hover:bg-crmHover disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]"
                >
                  {creating ? 'Creating…' : 'Push to Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          EDIT DRAWER
      ════════════════════════════════════════════════════ */}
      {editOpp && (
        <>
          <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden" onClick={() => setEditOpp(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-crmAccent/10 text-crmAccent flex items-center justify-center flex-shrink-0">
                  <Edit2 size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm">Edit Deal</h2>
                  <p className="text-xs text-slate-400 truncate">{editOpp.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditOpp(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto flex flex-col">
              <div className="flex-1 p-5 space-y-4">

                {/* Deal name */}
                <div>
                  <label className={labelCls}>Deal Name <span className="text-red-500">*</span></label>
                  <input
                    required type="text"
                    value={editForm.name}
                    onChange={e => setE('name', e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Amount + Close date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Est. Value ($)</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.amount}
                        onChange={e => setE('amount', e.target.value)}
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Close Target</label>
                    <input
                      type="date"
                      value={editForm.expected_close_date}
                      onChange={e => setE('expected_close_date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Stage */}
                <div>
                  <label className={labelCls}>Pipeline Stage</label>
                  <select
                    value={editForm.stage}
                    onChange={e => setE('stage', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all cursor-pointer"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Products */}
                <div>
                  <label className={labelCls}>Products</label>
                  <ProductMultiSelect
                    selected={editForm.selProducts}
                    onChange={v => setE('selProducts', v)}
                    products={productSummary}
                  />
                </div>

                {/* Accounts */}
                <div>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Related Accounts</label>
                    <span className="text-xs text-slate-400">(first selected = primary account)</span>
                  </div>
                  <AccountMultiSelect
                    selected={editForm.selAccounts}
                    onChange={v => setE('selAccounts', v)}
                    accounts={allAccounts}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditOpp(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-crmAccent hover:bg-crmHover disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default Opportunities;
