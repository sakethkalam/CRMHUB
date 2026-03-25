import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Bell, Shield, Palette } from 'lucide-react';

const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system default
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
};

const Settings = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('crm-theme') || 'system');
  const [notifPrefs, setNotifPrefs] = useState({
    newDeal: true,
    stageChange: true,
    newContact: false,
    weeklySummary: true,
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('crm-theme', theme);
  }, [theme]);

  const toggleNotif = (key) => setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  const Toggle = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-crmAccent focus:ring-offset-1 ${checked ? 'bg-crmAccent' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span className={`inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="text-crmAccent w-7 h-7" /> Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Customize your SHINSO experience.</p>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Palette size={16} /> Appearance
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose how SHINSO looks on your device.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', label: 'Light', Icon: Sun },
            { value: 'dark',  label: 'Dark',  Icon: Moon },
            { value: 'system',label: 'System',Icon: Monitor },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                theme === value
                  ? 'border-crmAccent bg-blue-50 dark:bg-crmAccent/10 text-crmAccent'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Bell size={16} /> Notifications
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Manage what activity you get notified about.</p>
        <div className="space-y-4">
          {[
            { key: 'newDeal',       label: 'New deal added to pipeline',  desc: 'Get notified when a new opportunity is created' },
            { key: 'stageChange',   label: 'Opportunity stage changes',   desc: 'Alert when a deal moves between pipeline stages' },
            { key: 'newContact',    label: 'New contact created',         desc: 'Notify when a new contact is added' },
            { key: 'weeklySummary', label: 'Weekly pipeline summary',     desc: 'Receive a summary of your pipeline every Monday' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
              <Toggle checked={notifPrefs[key]} onChange={() => toggleNotif(key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-white dark:bg-crmCard rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Shield size={16} /> Security
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Your session and authentication configuration.</p>
        <div className="space-y-0 text-sm divide-y divide-slate-100 dark:divide-slate-800">
          {[
            { label: 'Session expires',   value: '30 minutes',     color: '' },
            { label: 'Token storage',     value: 'httpOnly Cookie', color: '' },
            { label: 'Token algorithm',   value: 'HS256 JWT',       color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Transport',         value: 'SSL / TLS',       color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-2.5">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className={`font-semibold ${color || 'text-slate-800 dark:text-slate-200'}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
