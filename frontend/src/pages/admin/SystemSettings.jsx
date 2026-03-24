import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { api } from '../../context/AuthContext';

const AGREEMENT_TYPES = ['Standard', 'Enterprise', 'NDA', 'SLA', 'Custom'];

const inputCls = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1';
const descCls  = 'text-xs text-slate-400 mt-0.5';

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-crmAccent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-crmAccent' : 'bg-slate-200 dark:bg-slate-700'
    }`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// ── Setting row wrapper ───────────────────────────────────────────────────────
const SettingRow = ({ label, description, children }) => (
  <div className="flex items-start justify-between gap-6 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <div className="flex-1 min-w-0">
      <p className={labelCls}>{label}</p>
      {description && <p className={descCls}>{description}</p>}
    </div>
    <div className="flex-shrink-0 pt-0.5">
      {children}
    </div>
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
const SystemSettings = () => {
  const [settings, setSettings] = useState({
    AUTO_GENERATE_AGREEMENT_ON_CLOSE: false,
    DEFAULT_AGREEMENT_TYPE: 'Standard',
    EMAIL_NOTIFICATIONS_ENABLED: true,
    MAX_LOGIN_ATTEMPTS: 5,
  });
  const [original, setOriginal] = useState(null);   // for dirty-check
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/settings');
        setSettings(res.data);
        setOriginal(res.data);
      } catch {
        showToast('Failed to load settings.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        AUTO_GENERATE_AGREEMENT_ON_CLOSE: settings.AUTO_GENERATE_AGREEMENT_ON_CLOSE,
        DEFAULT_AGREEMENT_TYPE: settings.DEFAULT_AGREEMENT_TYPE,
        EMAIL_NOTIFICATIONS_ENABLED: settings.EMAIL_NOTIFICATIONS_ENABLED,
        MAX_LOGIN_ATTEMPTS: Number(settings.MAX_LOGIN_ATTEMPTS),
      };
      const res = await api.patch('/admin/settings', payload);
      setSettings(res.data);
      setOriginal(res.data);
      showToast('Settings saved successfully.');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = original && JSON.stringify(settings) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-400">Loading settings…</p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSave} className="max-w-2xl">

        {/* Deal Automation section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0 pb-2 border-b border-slate-200 dark:border-slate-800">
            Deal Automation
          </h3>
          <SettingRow
            label="Auto-Generate Agreement on Deal Close"
            description="When a deal moves to Closed Won, automatically generate and attach a draft agreement document."
          >
            <Toggle
              checked={settings.AUTO_GENERATE_AGREEMENT_ON_CLOSE}
              onChange={v => set('AUTO_GENERATE_AGREEMENT_ON_CLOSE', v)}
            />
          </SettingRow>

          <SettingRow
            label="Default Agreement Type"
            description="The agreement template used when auto-generation is triggered."
          >
            <select
              value={settings.DEFAULT_AGREEMENT_TYPE}
              onChange={e => set('DEFAULT_AGREEMENT_TYPE', e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white cursor-pointer min-w-[160px]"
            >
              {AGREEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </SettingRow>
        </div>

        {/* Notifications section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0 pb-2 border-b border-slate-200 dark:border-slate-800">
            Notifications
          </h3>
          <SettingRow
            label="Email Notifications Enabled"
            description="Send automated emails for approvals, task reminders, and deal updates across the system."
          >
            <Toggle
              checked={settings.EMAIL_NOTIFICATIONS_ENABLED}
              onChange={v => set('EMAIL_NOTIFICATIONS_ENABLED', v)}
            />
          </SettingRow>
        </div>

        {/* Security section */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0 pb-2 border-b border-slate-200 dark:border-slate-800">
            Security
          </h3>
          <SettingRow
            label="Max Login Attempts Before Lockout"
            description="Number of consecutive failed login attempts before an account is temporarily locked. Set to 0 to disable lockout."
          >
            <input
              type="number"
              min={0}
              max={20}
              value={settings.MAX_LOGIN_ATTEMPTS}
              onChange={e => set('MAX_LOGIN_ATTEMPTS', parseInt(e.target.value, 10) || 0)}
              className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white"
            />
          </SettingRow>
        </div>

        {/* Unsaved changes warning */}
        {isDirty && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} className="flex-shrink-0" />
            You have unsaved changes.
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
};

export default SystemSettings;
