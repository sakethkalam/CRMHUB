import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, CheckSquare, Percent,
  Phone, Mail, FileText, Calendar, Activity,
  Building2, Users, BarChart3, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { api, AuthContext } from '../context/AuthContext';

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CONFIG = {
  'Prospecting':   { color: '#94a3b8', bg: 'bg-slate-100  text-slate-700  dark:bg-slate-800  dark:text-slate-300' },
  'Qualification': { color: '#60a5fa', bg: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30 dark:text-blue-400' },
  'Proposal':      { color: '#a78bfa', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  'Negotiation':   { color: '#fbbf24', bg: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30 dark:text-amber-400' },
  'Closed Won':    { color: '#34d399', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'Closed Lost':   { color: '#f87171', bg: 'bg-red-100    text-red-700    dark:bg-red-900/30 dark:text-red-400' },
};

const OPEN_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'];

// ── Activity type → icon + color ─────────────────────────────────────────────
const ACTIVITY_CONFIG = {
  Call:    { Icon: Phone,    color: 'bg-blue-100   text-blue-600   dark:bg-blue-900/30 dark:text-blue-400' },
  Email:   { Icon: Mail,     color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  Note:    { Icon: FileText, color: 'bg-slate-100  text-slate-600  dark:bg-slate-800 dark:text-slate-400' },
  Meeting: { Icon: Calendar, color: 'bg-amber-100  text-amber-600  dark:bg-amber-900/30 dark:text-amber-400' },
};

// ── KPI card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, iconClass, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200' : ''}`}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {sub && (
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          {sub}
          {onClick && <ChevronRight size={11} />}
        </p>
      )}
    </div>
  </div>
);

// ── Custom recharts tooltip ───────────────────────────────────────────────────
const StageTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-xl text-sm min-w-[180px]">
      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{d.stage}</p>
      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex justify-between gap-6">
          <span>Deals</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{d.count}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Total Value</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(d.total_amount)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Weighted</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(d.weighted_amount)}</span>
        </div>
      </div>
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [pipeline, setPipeline]     = useState([]);   // [{stage, count, total_amount, weighted_amount}]
  const [winRate, setWinRate]       = useState(null);  // {win_rate_pct, ...}
  const [overdue, setOverdue]       = useState(0);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, wr, ov, acts] = await Promise.all([
          api.get('/opportunities/pipeline/by-stage'),
          api.get('/opportunities/win-rate'),
          api.get('/tasks/overdue?limit=100'),
          api.get('/activities/?limit=10'),
        ]);
        setPipeline(p.data);
        setWinRate(wr.data);
        setOverdue(ov.data.length);
        setActivities(acts.data);
      } catch {
        // silently fail — cards just stay at 0
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Derived KPIs from pipeline/by-stage
  const openPipeline = pipeline
    .filter(s => OPEN_STAGES.includes(s.stage))
    .reduce((sum, s) => sum + s.total_amount, 0);

  const weightedPipeline = pipeline
    .filter(s => OPEN_STAGES.includes(s.stage))
    .reduce((sum, s) => sum + s.weighted_amount, 0);

  // Chart data — only open stages, ordered
  const chartData = OPEN_STAGES
    .map(s => pipeline.find(p => p.stage === s))
    .filter(Boolean);

  const maxAmount = Math.max(1, ...chartData.map(s => s.total_amount));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-crmAccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Here's your sales pipeline overview.
        </p>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Open Pipeline"
          value={fmtCompact(openPipeline)}
          sub="Active opportunities"
          iconClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          icon={DollarSign}
          label="Weighted Pipeline"
          value={fmtCompact(weightedPipeline)}
          sub="Probability-adjusted"
          iconClass="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          icon={Percent}
          label="Win Rate"
          value={winRate ? `${winRate.win_rate_pct}%` : '—'}
          sub={winRate ? `${winRate.won} won / ${winRate.total_closed} closed` : 'No closed deals'}
          iconClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          icon={CheckSquare}
          label="Overdue Tasks"
          value={overdue}
          sub={overdue > 0 ? 'Click to review' : 'All caught up'}
          iconClass={overdue > 0
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
          onClick={() => navigate('/tasks?filter=overdue')}
        />
      </div>

      {/* ── Pipeline by Stage chart ── */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-crmAccent" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Pipeline by Stage</h2>
          </div>
          <p className="text-xs text-slate-400">Open deals only</p>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <BarChart3 size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No open opportunities yet</p>
          </div>
        ) : (
          <>
            {/* Recharts horizontal bar chart */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 10 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  type="number"
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={100}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<StageTooltip />} cursor={{ fill: 'rgba(148,163,184,0.07)' }} />
                <Bar dataKey="total_amount" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={v => `${v} deal${v !== 1 ? 's' : ''}`}
                    style={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  {chartData.map(entry => (
                    <Cell
                      key={entry.stage}
                      fill={STAGE_CONFIG[entry.stage]?.color ?? '#94a3b8'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Summary strip below chart */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {chartData.map(s => (
                <div key={s.stage} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.stage}</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {fmtCompact(s.total_amount)}
                  </p>
                  <p className="text-[11px] text-slate-400">{s.count} deal{s.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Recent Activity Feed ── */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-crmAccent" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Recent Activity</h2>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-xs text-crmAccent hover:text-crmHover font-medium transition-colors"
          >
            View all tasks →
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Activity size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No activity logged yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activities.map(act => {
              const cfg = ACTIVITY_CONFIG[act.type] ?? {
                Icon: Activity,
                color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              };
              const Icon = cfg.Icon;

              // Build "related to" label
              const relatedParts = [];
              if (act.account_id)     relatedParts.push({ label: 'Account', path: '/accounts' });
              if (act.contact_id)     relatedParts.push({ label: 'Contact', path: '/contacts' });
              if (act.opportunity_id) relatedParts.push({ label: 'Deal',    path: '/opportunities' });
              const primary = relatedParts[0];

              return (
                <div key={act.id} className="flex items-start gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 -mx-1 px-1 rounded-lg transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {act.type}
                      </span>
                      {primary && (
                        <button
                          onClick={() => navigate(primary.path)}
                          className="text-[11px] text-crmAccent hover:text-crmHover font-medium transition-colors"
                        >
                          → {primary.label}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-2">
                      {act.description}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(act.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
