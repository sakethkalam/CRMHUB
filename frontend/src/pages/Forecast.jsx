import { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, DollarSign, TrendingUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUARTERS = [
  { label: 'Current Quarter', value: 'current_quarter' },
  { label: 'Next Quarter',    value: 'next_quarter'    },
  { label: 'This Year',       value: 'this_year'       },
];

const FORECAST_CATEGORIES = ['Pipeline', 'Best Case', 'Commit', 'Closed'];

const CATEGORY_CONFIG = {
  Pipeline:    { icon: TrendingUp,   iconClass: 'bg-blue-100   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400',   labelClass: 'bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400'   },
  'Best Case': { icon: DollarSign,   iconClass: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', labelClass: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  Commit:      { icon: CheckCircle2, iconClass: 'bg-amber-100  text-amber-600  dark:bg-amber-900/30  dark:text-amber-400',  labelClass: 'bg-amber-50  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400'  },
  Closed:      { icon: CheckCircle2, iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', labelClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const STAGE_COLORS = {
  'Prospecting':   'bg-slate-100   text-slate-700   dark:bg-slate-800    dark:text-slate-300',
  'Qualification': 'bg-blue-50     text-blue-700    dark:bg-blue-900/30  dark:text-blue-400',
  'Proposal':      'bg-purple-50   text-purple-700  dark:bg-purple-900/30 dark:text-purple-400',
  'Negotiation':   'bg-amber-50    text-amber-700   dark:bg-amber-900/30 dark:text-amber-400',
  'Closed Won':    'bg-emerald-50  text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Closed Lost':   'bg-red-50      text-red-700     dark:bg-red-900/30   dark:text-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtCompact = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

// Quarter date bounds for client-side filtering
function quarterBounds(value) {
  const now = new Date();
  const q   = Math.floor(now.getMonth() / 3); // 0-indexed current quarter
  if (value === 'current_quarter') {
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end   = new Date(now.getFullYear(), q * 3 + 3, 1);
    return [start, end];
  }
  if (value === 'next_quarter') {
    const nq    = (q + 1) % 4;
    const yr    = q === 3 ? now.getFullYear() + 1 : now.getFullYear();
    const start = new Date(yr, nq * 3, 1);
    const end   = new Date(yr, nq * 3 + 3, 1);
    return [start, end];
  }
  if (value === 'this_year') {
    return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
  }
  return [null, null];
}

// ── Inline probability input ──────────────────────────────────────────────────
const ProbInput = ({ opp, onSave, saving }) => {
  const [val, setVal] = useState(opp.probability ?? 0);
  const original = useRef(opp.probability ?? 0);

  // Sync if parent updates (e.g. after save response)
  useEffect(() => {
    setVal(opp.probability ?? 0);
    original.current = opp.probability ?? 0;
  }, [opp.probability]);

  const commit = () => {
    const n = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    setVal(n);
    if (n !== original.current) onSave(opp.id, { probability: n });
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        value={val}
        disabled={saving}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
        className="w-16 px-2 py-1 text-center text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crmAccent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      />
      <span className="text-xs text-slate-400">%</span>
    </div>
  );
};

// ── Forecast category dropdown ────────────────────────────────────────────────
const CategorySelect = ({ opp, onSave, saving }) => {
  const cfg = CATEGORY_CONFIG[opp.forecast_category] ?? CATEGORY_CONFIG.Pipeline;
  return (
    <select
      value={opp.forecast_category}
      disabled={saving}
      onChange={e => onSave(opp.id, { forecast_category: e.target.value })}
      className={`text-xs font-semibold px-2 py-1 rounded-md border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-crmAccent disabled:opacity-50 disabled:cursor-not-allowed transition-all ${cfg.labelClass}`}
    >
      {FORECAST_CATEGORIES.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const Forecast = () => {
  const [dateRange, setDateRange]   = useState('current_quarter');
  const [summary, setSummary]       = useState(null);
  const [opps, setOpps]             = useState([]);
  const [accounts, setAccounts]     = useState({});   // id → name map
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [oppsLoading, setOppsLoading]       = useState(true);
  const [saving, setSaving]         = useState({});   // { [opp_id]: true }
  const [toast, setToast]           = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch summary KPIs (re-fetch on date range change)
  useEffect(() => {
    setSummaryLoading(true);
    api.get(`/opportunities/forecast/summary?date_range=${dateRange}`)
      .then(r => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [dateRange]);

  // Fetch opportunities + accounts once
  useEffect(() => {
    setOppsLoading(true);
    Promise.all([
      api.get('/opportunities/?limit=100'),
      api.get('/accounts/?limit=200'),
    ])
      .then(([o, a]) => {
        setOpps(o.data);
        const map = {};
        a.data.forEach(acc => { map[acc.id] = acc.name; });
        setAccounts(map);
      })
      .catch(() => {})
      .finally(() => setOppsLoading(false));
  }, []);

  // Client-side filter by expected_close_date falling in selected range
  const [rangeStart, rangeEnd] = quarterBounds(dateRange);
  const filteredOpps = opps.filter(o => {
    if (!o.expected_close_date) return true;   // no close date → always include
    const d = new Date(o.expected_close_date);
    if (rangeStart && d < rangeStart) return false;
    if (rangeEnd   && d >= rangeEnd)  return false;
    return true;
  });

  // Counts per category for the KPI cards
  const countByCategory = {};
  filteredOpps.forEach(o => {
    countByCategory[o.forecast_category] = (countByCategory[o.forecast_category] ?? 0) + 1;
  });

  // Inline save handler
  const handleSave = useCallback(async (oppId, patch) => {
    setSaving(s => ({ ...s, [oppId]: true }));
    try {
      const res = await api.patch(`/opportunities/${oppId}`, patch);
      setOpps(prev => prev.map(o => o.id === oppId ? res.data : o));
    } catch {
      setToast({ type: 'error', message: 'Failed to save — please try again.' });
    } finally {
      setSaving(s => { const n = { ...s }; delete n[oppId]; return n; });
    }
  }, []);

  // KPI card data
  const kpiRows = [
    { key: 'pipeline_total',  label: 'Pipeline',  field: 'pipeline_total'  },
    { key: 'best_case_total', label: 'Best Case', field: 'best_case_total' },
    { key: 'commit_total',    label: 'Commit',    field: 'commit_total'    },
    { key: 'closed_total',    label: 'Closed',    field: 'closed_total'    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <LineChart className="text-crmAccent w-7 h-7" /> Forecast
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Revenue forecast and weighted pipeline by period.
          </p>
        </div>

        {/* Quarter selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex-shrink-0">
          {QUARTERS.map(q => (
            <button
              key={q.value}
              onClick={() => setDateRange(q.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                dateRange === q.value
                  ? 'bg-white dark:bg-crmCard text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiRows.map(({ label, field }) => {
          const cfg   = CATEGORY_CONFIG[label];
          const Icon  = cfg.icon;
          const total = summary?.[field] ?? 0;
          const count = countByCategory[label] ?? 0;
          return (
            <div key={label} className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconClass}`}>
                  <Icon size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
              </div>
              {summaryLoading ? (
                <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCompact(total)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{count} deal{count !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Opportunities table ── */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LineChart size={15} className="text-crmAccent" />
            Opportunities
            {!oppsLoading && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                ({filteredOpps.length})
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Edit Forecast Category or Probability inline — saves immediately.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Name</th>
                <th className="px-4 py-3.5 font-semibold">Account</th>
                <th className="px-4 py-3.5 font-semibold">Stage</th>
                <th className="px-4 py-3.5 font-semibold">Forecast Category</th>
                <th className="px-4 py-3.5 font-semibold text-right">Amount</th>
                <th className="px-4 py-3.5 font-semibold text-right">Weighted</th>
                <th className="px-4 py-3.5 font-semibold">Probability</th>
                <th className="px-4 py-3.5 font-semibold">Expected Close</th>
                <th className="px-4 py-3.5 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {oppsLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-slate-400">Loading opportunities…</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOpps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <XCircle size={32} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No opportunities in this period.</p>
                  </td>
                </tr>
              ) : (
                filteredOpps.map(opp => {
                  const isSaving    = !!saving[opp.id];
                  const stageColor  = STAGE_COLORS[opp.stage] ?? STAGE_COLORS['Prospecting'];
                  const accountName = accounts[opp.account_id] ?? (opp.account_id ? `#${opp.account_id}` : '—');
                  const closeDate   = opp.expected_close_date
                    ? new Date(opp.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';

                  return (
                    <tr
                      key={opp.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isSaving ? 'opacity-60' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{opp.name}</p>
                      </td>

                      {/* Account */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {accountName}
                      </td>

                      {/* Stage */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageColor}`}>
                          {opp.stage}
                        </span>
                      </td>

                      {/* Forecast Category — inline dropdown */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin text-crmAccent" />
                        ) : (
                          <CategorySelect opp={opp} onSave={handleSave} saving={isSaving} />
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {fmt(opp.amount)}
                        </span>
                      </td>

                      {/* Weighted */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {fmt(opp.weighted_amount)}
                        </span>
                      </td>

                      {/* Probability — inline input */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ProbInput opp={opp} onSave={handleSave} saving={isSaving} />
                      </td>

                      {/* Expected Close */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {closeDate}
                      </td>

                      {/* Owner (via account) */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {opp.owner
                          ? opp.owner.full_name ?? opp.owner.email
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
            : 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
        }`}>
          {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Forecast;
