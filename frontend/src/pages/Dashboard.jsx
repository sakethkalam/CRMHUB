import { useState, useEffect, useContext } from 'react';
import { Building2, Users, TrendingUp, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api, AuthContext } from '../context/AuthContext';

const STAGE_COLORS = {
  "Prospecting":   { bar: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  "Qualification": { bar: 'bg-blue-400',    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  "Proposal":      { bar: 'bg-purple-400',  pill: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  "Negotiation":   { bar: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  "Closed Won":    { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  "Closed Lost":   { bar: 'bg-red-400',     pill: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const STAGE_MAP = {
  PROSPECTING: 'Prospecting',
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, c, o] = await Promise.all([
          api.get('/accounts'),
          api.get('/contacts'),
          api.get('/opportunities'),
        ]);
        setAccounts(a.data);
        setContacts(c.data);
        setOpportunities(o.data);
      } catch {
        // silently fail — stats just stay at 0
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Derived stats
  const totalPipelineValue = opportunities
    .filter(o => !['CLOSED_WON', 'CLOSED_LOST'].includes(o.stage))
    .reduce((sum, o) => sum + (o.value || 0), 0);

  const wonValue = opportunities
    .filter(o => o.stage === 'CLOSED_WON')
    .reduce((sum, o) => sum + (o.value || 0), 0);

  const winRate = opportunities.length > 0
    ? Math.round(opportunities.filter(o => o.stage === 'CLOSED_WON').length / opportunities.length * 100)
    : 0;

  // Pipeline by stage
  const stageCounts = {};
  const stageValues = {};
  opportunities.forEach(o => {
    const label = STAGE_MAP[o.stage] || o.stage;
    stageCounts[label] = (stageCounts[label] || 0) + 1;
    stageValues[label] = (stageValues[label] || 0) + (o.value || 0);
  });

  const maxCount = Math.max(1, ...Object.values(stageCounts));

  // Recent opportunities (last 5)
  const recentOpps = [...opportunities]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

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
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here's what's happening in your pipeline today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Accounts"
          value={accounts.length}
          sub="Total accounts"
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={Users}
          label="Contacts"
          value={contacts.length}
          sub="Total contacts"
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Pipeline"
          value={fmt(totalPipelineValue)}
          sub="Active opportunities"
          color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={DollarSign}
          label="Won"
          value={fmt(wonValue)}
          sub={`${winRate}% win rate`}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-crmAccent" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Pipeline by Stage</h2>
          </div>
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No opportunities yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(STAGE_MAP).map(([key, label]) => {
                const count = stageCounts[label] || 0;
                const val = stageValues[label] || 0;
                if (count === 0) return null;
                const colors = STAGE_COLORS[label] || { bar: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700' };
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.pill}`}>{label}</span>
                        <span className="text-xs text-slate-400">{count} deal{count !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Opportunities */}
        <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-crmAccent" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Recent Deals</h2>
          </div>
          {recentOpps.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No deals yet</p>
          ) : (
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              {recentOpps.map(opp => {
                const label = STAGE_MAP[opp.stage] || opp.stage;
                const colors = STAGE_COLORS[label] || { pill: 'bg-slate-100 text-slate-700' };
                const isWon = opp.stage === 'CLOSED_WON';
                const isLost = opp.stage === 'CLOSED_LOST';
                return (
                  <div key={opp.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{opp.name}</p>
                      <span className={`inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.pill}`}>{label}</span>
                    </div>
                    <div className="ml-4 flex items-center gap-1.5 flex-shrink-0">
                      {isWon && <ArrowUpRight size={14} className="text-emerald-500" />}
                      {isLost && <ArrowDownRight size={14} className="text-red-400" />}
                      <span className={`text-sm font-semibold ${isWon ? 'text-emerald-600 dark:text-emerald-400' : isLost ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {fmt(opp.value || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-crmAccent" /> Pipeline Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Total Deals',   value: opportunities.length },
            { label: 'Active',        value: opportunities.filter(o => !['CLOSED_WON','CLOSED_LOST'].includes(o.stage)).length },
            { label: 'Won',           value: opportunities.filter(o => o.stage === 'CLOSED_WON').length },
            { label: 'Lost',          value: opportunities.filter(o => o.stage === 'CLOSED_LOST').length },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
