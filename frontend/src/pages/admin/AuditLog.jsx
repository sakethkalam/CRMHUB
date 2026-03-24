import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Download, ChevronDown, ChevronRight, Search, X, CheckCircle2 } from 'lucide-react';
import { api } from '../../context/AuthContext';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

const TABLES = ['users', 'accounts', 'contacts', 'opportunities', 'leads', 'tasks', 'system_settings'];

// Deep-link table name → CRM route (best-effort, pages use drawers not record routes)
const TABLE_ROUTE = {
  accounts: '/accounts',
  contacts: '/contacts',
  opportunities: '/opportunities',
  leads: '/leads',
  tasks: '/tasks',
  users: '/admin/users',
};

const ACTION_COLORS = {
  CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

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
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
};

// Renders a JSON diff in an expandable panel
const ChangesViewer = ({ changes }) => {
  const [open, setOpen] = useState(false);
  if (!changes) return <span className="text-slate-400">—</span>;

  let parsed;
  try {
    parsed = JSON.parse(changes);
  } catch {
    return <span className="text-slate-400 text-xs font-mono">{changes.slice(0, 60)}…</span>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-crmAccent hover:text-crmHover font-semibold transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? 'Hide' : 'Show'} diff
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          {parsed.old !== undefined && (
            <div>
              <p className="font-bold text-slate-500 mb-1 uppercase tracking-wider">Before</p>
              <pre className="bg-red-50/80 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-400">
                {JSON.stringify(parsed.old, null, 2)}
              </pre>
            </div>
          )}
          {parsed.new !== undefined && (
            <div>
              <p className="font-bold text-slate-500 mb-1 uppercase tracking-wider">After</p>
              <pre className="bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap text-emerald-700 dark:text-emerald-400">
                {JSON.stringify(parsed.new, null, 2)}
              </pre>
            </div>
          )}
          {parsed.old === undefined && parsed.new === undefined && (
            <div className="col-span-2">
              <pre className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AuditLog = () => {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [actionF, setActionF]     = useState('');
  const [tableF, setTableF]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (actionF)   params.set('action', actionF);
      if (tableF)    params.set('table_name', tableF);
      if (dateFrom)  params.set('date_from', dateFrom);
      if (dateTo)    params.set('date_to', dateTo);
      const res = await api.get(`/admin/audit-log?${params}`);
      setLogs(res.data);
    } catch {
      showToast('Failed to load audit log.', 'error');
    } finally {
      setLoading(false);
    }
  }, [actionF, tableF, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side email/user search
  const visible = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.user_email || '').toLowerCase().includes(q) ||
           (l.table_name || '').toLowerCase().includes(q);
  });

  const handleExportCSV = () => {
    const params = new URLSearchParams({ format: 'csv', limit: 1000 });
    if (actionF) params.set('action', actionF);
    if (tableF)  params.set('table_name', tableF);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    // Trigger download via anchor — cookie auth is sent automatically
    const link = document.createElement('a');
    link.href = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/admin/audit-log?${params}`;
    link.download = 'audit_log.csv';
    link.click();
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search user or table…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200"
          />
        </div>

        {/* Action filter */}
        <select
          value={actionF}
          onChange={e => setActionF(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
        >
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Table filter */}
        <select
          value={tableF}
          onChange={e => setTableF(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
        >
          <option value="">All Tables</option>
          {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          title="From date"
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          title="To date"
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200"
        />

        {/* Reset filters */}
        {(actionF || tableF || dateFrom || dateTo || search) && (
          <button
            onClick={() => { setActionF(''); setTableF(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          >
            <X size={14} /> Clear
          </button>
        )}

        <div className="flex-1" />

        {/* Export CSV */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Stats strip */}
      <p className="text-xs text-slate-400 mb-3">
        {loading ? 'Loading…' : `${visible.length} event${visible.length !== 1 ? 's' : ''} shown`}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3.5 font-semibold">Timestamp</th>
              <th className="px-4 py-3.5 font-semibold">User</th>
              <th className="px-4 py-3.5 font-semibold">Action</th>
              <th className="px-4 py-3.5 font-semibold">Table</th>
              <th className="px-4 py-3.5 font-semibold">Record ID</th>
              <th className="px-4 py-3.5 font-semibold min-w-[200px]">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                    <p className="mt-2 text-sm">Loading audit log…</p>
                  </div>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center">
                  <ScrollText size={32} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No audit events found.</p>
                  <p className="text-slate-400 text-xs mt-1">Events are recorded for admin actions from this point forward.</p>
                </td>
              </tr>
            ) : (
              visible.map(log => {
                const route = TABLE_ROUTE[log.table_name];
                return (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {log.user_email || (log.user_id ? `User #${log.user_id}` : 'System')}
                    </td>

                    {/* Action badge */}
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Table */}
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {log.table_name}
                    </td>

                    {/* Record ID — clickable deep-link */}
                    <td className="px-4 py-3">
                      {log.record_id != null ? (
                        route ? (
                          <a
                            href={route}
                            className="text-xs font-semibold text-crmAccent hover:text-crmHover transition-colors underline underline-offset-2"
                            title={`Go to ${log.table_name} list`}
                          >
                            #{log.record_id}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">#{log.record_id}</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Changes diff */}
                    <td className="px-4 py-3">
                      <ChangesViewer changes={log.changes} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
};

export default AuditLog;
