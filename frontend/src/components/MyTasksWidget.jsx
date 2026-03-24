import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const PRIORITY_DOT = {
  'Urgent': 'bg-red-500',
  'High':   'bg-orange-400',
  'Medium': 'bg-amber-400',
  'Low':    'bg-slate-400',
};

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const weekEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 59, 999);
  return d;
};

const MyTasksWidget = () => {
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [completingIds, setCompletingIds] = useState(new Set());
  const navigate = useNavigate();

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks/my-tasks?limit=20');
      setTasks(res.data.filter(t => t.status !== 'Completed'));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleComplete = async (taskId, e) => {
    e.stopPropagation();
    setCompletingIds(prev => new Set([...prev, taskId]));
    try {
      await api.post(`/tasks/${taskId}/complete`);
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setCompletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      }, 350);
    } catch {
      setCompletingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  // Partition into today / this week / later
  const now     = new Date();
  const today   = todayStart();
  const weekEnd_ = weekEnd();

  const overdue  = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
  const dueToday = tasks.filter(t => t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= new Date(today.getTime() + 86400000 - 1));
  const thisWeek = tasks.filter(t => t.due_date && new Date(t.due_date) > new Date(today.getTime() + 86400000 - 1) && new Date(t.due_date) <= weekEnd_);
  const noDue    = tasks.filter(t => !t.due_date);

  const sections = [
    { label: 'Overdue',    items: overdue,  labelCls: 'text-red-500' },
    { label: 'Today',      items: dueToday, labelCls: 'text-amber-500' },
    { label: 'This Week',  items: thisWeek, labelCls: 'text-slate-500 dark:text-slate-400' },
    { label: 'No Due Date',items: noDue,    labelCls: 'text-slate-400' },
  ].filter(s => s.items.length > 0);

  if (loading) {
    return (
      <div className="px-3 py-4 flex justify-center">
        <div className="w-4 h-4 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="px-3 py-3 text-center">
        <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-1" />
        <p className="text-xs text-slate-400">All caught up!</p>
      </div>
    );
  }

  const TaskRow = ({ task }) => {
    const completing = completingIds.has(task.id);
    const isOver = task.due_date && new Date(task.due_date) < now;

    return (
      <div
        style={{ transition: 'opacity 0.35s, max-height 0.35s' }}
        className={`flex items-start gap-2 py-1.5 group
          ${completing ? 'opacity-0 pointer-events-none max-h-0 overflow-hidden' : 'opacity-100 max-h-20'}`}
      >
        <button
          onClick={(e) => handleComplete(task.id, e)}
          className="flex-shrink-0 mt-0.5"
          title="Mark complete"
        >
          <div className={`w-3.5 h-3.5 rounded-full border-2 transition-colors flex-shrink-0
            ${isOver
              ? 'border-red-400 hover:bg-red-100 dark:hover:bg-red-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-crmAccent'
            }`}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`} />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate leading-snug">
              {task.subject}
            </p>
          </div>
          {task.due_date && (
            <p className={`text-[10px] mt-0.5 ml-3 flex items-center gap-1
              ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
              {isOver ? <AlertTriangle size={9} /> : <Clock size={9} />}
              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 pb-2">
      {sections.map(section => (
        <div key={section.label} className="mb-2">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${section.labelCls}`}>
            {section.label}
          </p>
          {section.items.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      ))}

      <button
        onClick={() => navigate('/tasks')}
        className="mt-1 w-full flex items-center justify-center gap-1 text-[11px] text-crmAccent hover:text-crmHover font-semibold transition-colors py-1"
      >
        View all tasks <ExternalLink size={11} />
      </button>
    </div>
  );
};

export default MyTasksWidget;
