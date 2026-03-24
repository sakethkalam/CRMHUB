import { useState, useEffect, useContext } from 'react';
import { X } from 'lucide-react';
import { api, AuthContext } from '../context/AuthContext';

const TYPES      = ['Call', 'Email', 'Follow Up', 'Demo', 'Send Proposal', 'Other'];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

const EMPTY_FORM = {
  subject: '',
  description: '',
  due_date: '',
  priority: 'Medium',
  type: 'Follow Up',
  assigned_to_id: '',
  related_account_id: '',
  related_contact_id: '',
  related_opportunity_id: '',
};

/**
 * TaskModal — reusable Add Task dialog.
 *
 * Props:
 *   open        — boolean
 *   onClose     — fn()
 *   onSaved     — fn() called after successful save
 *   prefill     — { related_account_id?, related_contact_id?, related_opportunity_id? }
 *                 Pre-fills the link fields AND hides those pickers from the form.
 */
const TaskModal = ({ open, onClose, onSaved, prefill = {} }) => {
  const { user } = useContext(AuthContext);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [users, setUsers]     = useState([]);
  const [accounts, setAccounts]           = useState([]);
  const [contacts, setContacts]           = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open) return;

    // Pre-fill form: stringify IDs so selects match option values
    setForm({
      ...EMPTY_FORM,
      assigned_to_id: user?.id ? String(user.id) : '',
      related_account_id:     prefill.related_account_id     ? String(prefill.related_account_id)     : '',
      related_contact_id:     prefill.related_contact_id     ? String(prefill.related_contact_id)     : '',
      related_opportunity_id: prefill.related_opportunity_id ? String(prefill.related_opportunity_id) : '',
    });
    setError('');

    Promise.all([
      api.get('/users/?limit=200'),
      prefill.related_account_id     ? Promise.resolve(null) : api.get('/accounts/?limit=200'),
      prefill.related_contact_id     ? Promise.resolve(null) : api.get('/contacts/?limit=200'),
      prefill.related_opportunity_id ? Promise.resolve(null) : api.get('/opportunities/?limit=200'),
    ]).then(([u, a, c, o]) => {
      setUsers(u.data);
      if (a) setAccounts(a.data);
      if (c) setContacts(c.data);
      if (o) setOpportunities(o.data);
    }).catch(console.error);
  }, [open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        subject:     form.subject,
        description: form.description || null,
        priority:    form.priority,
        type:        form.type,
        assigned_to_id:         parseInt(form.assigned_to_id),
        related_account_id:     form.related_account_id     ? parseInt(form.related_account_id)     : null,
        related_contact_id:     form.related_contact_id     ? parseInt(form.related_contact_id)     : null,
        related_opportunity_id: form.related_opportunity_id ? parseInt(form.related_opportunity_id) : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      };
      await api.post('/tasks/', payload);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-crmCard w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Subject */}
          <div>
            <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
            <input required type="text" value={form.subject} onChange={e => set('subject', e.target.value)}
              className={inputCls} placeholder="e.g. Follow up on proposal" />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls + ' cursor-pointer'}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls + ' cursor-pointer'}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Due Date + Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="datetime-local" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assigned To <span className="text-red-500">*</span></label>
              <select required value={form.assigned_to_id} onChange={e => set('assigned_to_id', e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">Select user…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              className={inputCls + ' resize-none'} placeholder="Optional details…" />
          </div>

          {/* Link to — only show pickers that aren't pre-filled */}
          {(!prefill.related_account_id || !prefill.related_contact_id || !prefill.related_opportunity_id) && (
            <div className="pt-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Link to (optional)</p>
              <div className="space-y-3">
                {!prefill.related_account_id && (
                  <div>
                    <label className={labelCls}>Account</label>
                    <select value={form.related_account_id} onChange={e => set('related_account_id', e.target.value)} className={inputCls + ' cursor-pointer'}>
                      <option value="">— None —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {!prefill.related_contact_id && (
                  <div>
                    <label className={labelCls}>Contact</label>
                    <select value={form.related_contact_id} onChange={e => set('related_contact_id', e.target.value)} className={inputCls + ' cursor-pointer'}>
                      <option value="">— None —</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                  </div>
                )}
                {!prefill.related_opportunity_id && (
                  <div>
                    <label className={labelCls}>Opportunity</label>
                    <select value={form.related_opportunity_id} onChange={e => set('related_opportunity_id', e.target.value)} className={inputCls + ' cursor-pointer'}>
                      <option value="">— None —</option>
                      {opportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
