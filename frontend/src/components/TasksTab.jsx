import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../context/AuthContext';
import TaskModal from './TaskModal';

const PRIORITY_STYLES = {
  'Urgent': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  'High':   'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-700',
  'Medium': 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-700',
  'Low':    'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

/**
 * TasksTab — embeddable "Tasks" panel for Account / Contact / Opportunity drawers.
 *
 * Pass exactly one of: relatedAccountId, relatedContactId, relatedOpportunityId
 */
const TasksTab = ({ relatedAccountId, relatedContactId, relatedOpportunityId }) => {
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [completingIds, setCompletingIds] = useState(new Set());

  const prefill = {
    ...(relatedAccountId     && { related_account_id:     relatedAccountId }),
    ...(relatedContactId     && { related_contact_id:     relatedContactId }),
    ...(relatedOpportunityId && { related_opportunity_id: relatedOpportunityId }),
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (relatedAccountId)     params.set('related_account_id',     relatedAccountId);
      if (relatedContactId)     params.set('related_contact_id',     relatedContactId);
      if (relatedOpportunityId) params.set('related_opportunity_id', relatedOpportunityId);
      const res = await api.get(`/tasks/?${params}`);
      setTasks(res.data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [relatedAccountId, relatedContactId, relatedOpportunityId]);

  const handleComplete = async (taskId) => {
    setCompletingIds(prev => new Set([...prev, taskId]));
    try {
      await api.post(`/tasks/${taskId}/complete`);
      // Animate out, then remove
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setCompletingIds(prev => {
          const s = new Set(prev);
          s.delete(taskId);
          return s;
        });
      }, 380);
    } catch {
      setCompletingIds(prev => {
        const s = new Set(prev);
        s.delete(taskId);
        return s;
      });
    }
  };

  const isOverdue = (task) =>
    task.due_date && task.status !== 'Completed' && new Date(task.due_date) < new Date();

  const open      = tasks.filter(t => t.status !== 'Completed');
  const completed = tasks.filter(t => t.status === 'Completed');

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {open.length} open{completed.length > 0 ? `, ${completed.length} completed` : ''}
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-crmAccent hover:text-crmHover transition-colors"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6">
          <CheckSquare size={26} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-1">No tasks yet</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs text-crmAccent hover:text-crmHover font-semibold"
          >
            + Add the first task
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => {
            const overdue    = isOverdue(task);
            const completing = completingIds.has(task.id);
            const done       = task.status === 'Completed';

            return (
              <div
                key={task.id}
                style={{ transition: 'opacity 0.38s, transform 0.38s' }}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border
                  ${completing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}
                  ${done
                    ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800'
                    : overdue
                    ? 'bg-red-50/60 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
                    : 'bg-white dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
                  }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => !done && !completing && handleComplete(task.id)}
                  disabled={done || completing}
                  className="flex-shrink-0 mt-0.5 focus:outline-none"
                  title={done ? 'Completed' : 'Mark complete'}
                >
                  {done ? (
                    <CheckCircle2 size={17} className="text-emerald-500" />
                  ) : (
                    <div className={`w-[17px] h-[17px] rounded-full border-2 transition-colors
                      ${overdue
                        ? 'border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'border-slate-300 dark:border-slate-600 hover:border-crmAccent'
                      }`}
                    />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug
                    ${done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {task.subject}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border
                      ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES['Low']}`}>
                      {task.priority}
                    </span>
                    <span className="text-[11px] text-slate-400">{task.type}</span>
                    {task.due_date && (
                      <span className={`flex items-center gap-1 text-[11px] font-medium
                        ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                        {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                        {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {task.assigned_to && (
                      <span className="text-[11px] text-slate-400">
                        → {task.assigned_to.full_name || task.assigned_to.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchTasks}
        prefill={prefill}
      />
    </>
  );
};

export default TasksTab;
