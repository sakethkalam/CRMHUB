import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, Search, Clock, AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { api } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';

const STATUSES   = ['Open', 'In Progress', 'Deferred', 'Completed'];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

const STATUS_STYLES = {
  'Open':        'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'In Progress': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Deferred':    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'Completed':   'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const PRIORITY_STYLES = {
  'Urgent': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'High':   'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  'Medium': 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  'Low':    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const Tasks = () => {
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [priorityFilter, setPriority] = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [deletingIds, setDeletingIds]     = useState(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter)   params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const res = await api.get(`/tasks/?${params}`);
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Client-side subject search
  const visible = tasks.filter(t => {
    if (!search) return true;
    return t.subject.toLowerCase().includes(search.toLowerCase());
  });

  const handleComplete = async (taskId) => {
    setCompletingIds(prev => new Set([...prev, taskId]));
    try {
      await api.post(`/tasks/${taskId}/complete`);
      setTimeout(() => {
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: 'Completed', completed_at: new Date().toISOString() } : t
        ));
        setCompletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      }, 380);
    } catch {
      setCompletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeletingIds(prev => new Set([...prev, taskId]));
    try {
      await api.delete(`/tasks/${taskId}`);
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setDeletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      }, 350);
    } catch {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  const isOverdue = (task) =>
    task.due_date && task.status !== 'Completed' && new Date(task.due_date) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <CheckSquare className="text-crmAccent w-7 h-7" /> Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Follow-ups, calls, and reminders linked to your CRM records.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus size={18} /> New Task
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Status pills */}
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

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriority(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-crmAccent transition-all cursor-pointer"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold w-10" />
                <th className="px-4 py-3.5 font-semibold">Subject</th>
                <th className="px-4 py-3.5 font-semibold">Type</th>
                <th className="px-4 py-3.5 font-semibold">Priority</th>
                <th className="px-4 py-3.5 font-semibold">Due Date</th>
                <th className="px-4 py-3.5 font-semibold">Assigned To</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Linked To</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-slate-500">Loading tasks…</p>
                    </div>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-400 text-sm">
                    No tasks found. Create your first task to stay organised.
                  </td>
                </tr>
              ) : (
                visible.map(task => {
                  const overdue    = isOverdue(task);
                  const completing = completingIds.has(task.id);
                  const deleting   = deletingIds.has(task.id);
                  const done       = task.status === 'Completed';

                  // Build linked-to label
                  const linked = [
                    task.related_account?.name,
                    task.related_contact ? `${task.related_contact.first_name} ${task.related_contact.last_name}` : null,
                    task.related_opportunity?.name,
                  ].filter(Boolean).join(', ');

                  return (
                    <tr
                      key={task.id}
                      style={{ transition: 'opacity 0.38s, transform 0.38s' }}
                      className={`group transition-colors
                        ${completing || deleting ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                        ${done
                          ? 'bg-slate-50/40 dark:bg-transparent'
                          : overdue
                          ? 'bg-red-50/40 dark:bg-red-900/5 hover:bg-red-50/70 dark:hover:bg-red-900/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => !done && handleComplete(task.id)}
                          disabled={done || completing}
                          className="focus:outline-none"
                          title={done ? 'Completed' : 'Mark complete'}
                        >
                          {done ? (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          ) : (
                            <div className={`w-[18px] h-[18px] rounded-full border-2 transition-colors
                              ${overdue
                                ? 'border-red-400 hover:bg-red-50'
                                : 'border-slate-300 dark:border-slate-600 hover:border-crmAccent'
                              }`}
                            />
                          )}
                        </button>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className={`font-medium leading-snug truncate
                          ${done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {task.subject}
                        </p>
                        {task.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{task.type}</td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] || ''}`}>
                          {task.priority}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3">
                        {task.due_date ? (
                          <span className={`flex items-center gap-1 text-xs font-medium
                            ${overdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {task.assigned_to?.full_name || task.assigned_to?.email || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[task.status] || ''}`}>
                          {task.status}
                        </span>
                      </td>

                      {/* Linked To */}
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate">
                        {linked || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDelete(task.id)}
                            title="Delete task"
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          >
                            <Trash2 size={15} />
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

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchTasks}
      />
    </div>
  );
};

export default Tasks;
