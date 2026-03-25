import { useContext, useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  Search,
  X,
  TrendingUp,
  UserPlus,
  CheckSquare,
  ChevronDown,
  Shield,
  LineChart,
  Package,
} from 'lucide-react';
import { AuthContext, api } from '../context/AuthContext';
import ChatBot from './ChatBot';
import GlobalSearch from './GlobalSearch';
import MyTasksWidget from './MyTasksWidget';

const Layout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen]           = useState(false);
  const [notifications, setNotifications]   = useState([]);
  const [notifLoading, setNotifLoading]     = useState(false);
  const [myTasksOpen, setMyTasksOpen]       = useState(false);
  const [overdueBadge, setOverdueBadge]     = useState(0);
  const notifRef = useRef(null);

  // Fetch overdue count for nav badge
  useEffect(() => {
    api.get('/tasks/overdue?limit=50')
      .then(res => setOverdueBadge(res.data.length))
      .catch(() => {});
  }, []);

  const navLinks = [
    { name: 'Dashboard',     path: '/',              icon: LayoutDashboard },
    { name: 'Accounts',      path: '/accounts',      icon: Building2 },
    { name: 'Contacts',      path: '/contacts',      icon: Users },
    { name: 'Opportunities', path: '/opportunities', icon: BarChart3 },
    { name: 'Leads',         path: '/leads',         icon: UserPlus },
    { name: 'Tasks',         path: '/tasks',         icon: CheckSquare, badge: overdueBadge },
    { name: 'Forecast',      path: '/forecast',      icon: LineChart },
    { name: 'Products',      path: '/products',      icon: Package },
  ];

  // Fetch recent activity for notifications panel
  useEffect(() => {
    if (!notifOpen) return;
    const load = async () => {
      setNotifLoading(true);
      try {
        const [accs, opps, contacts] = await Promise.all([
          api.get('/accounts?limit=3'),
          api.get('/opportunities?limit=4'),
          api.get('/contacts?limit=3'),
        ]);
        const items = [
          ...accs.data.map(a => ({ type: 'account',  label: `Account added: ${a.name}`,          sub: a.industry || 'No industry', time: a.created_at, Icon: Building2 })),
          ...opps.data.map(o => ({ type: 'opp',      label: `Deal: ${o.name}`,                   sub: o.stage.replace('_', ' '),   time: o.created_at, Icon: TrendingUp })),
          ...contacts.data.map(c => ({ type: 'contact', label: `Contact: ${c.first_name} ${c.last_name}`, sub: c.email || 'No email', time: c.created_at, Icon: UserPlus })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
        setNotifications(items);
      } catch {
        setNotifications([]);
      } finally {
        setNotifLoading(false);
      }
    };
    load();
  }, [notifOpen]);

  // Close notif panel when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const openSearch = () => window.dispatchEvent(new CustomEvent('crm:open-search'));

  const typeColors = {
    account: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    opp:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    contact: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-crmCard border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-shinso-400 flex items-center justify-center text-white shadow-sm">
            <BarChart3 size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-[#7984EE] text-base tracking-tight">SHINSO</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">The Intelligent Layer</span>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-0.5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ` +
                (isActive
                  ? `bg-shinso-50 dark:bg-shinso-400/15 text-shinso-600 dark:text-shinso-400`
                  : `text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100`)
              }
              end={link.path === '/'}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
              <span className="flex-1">{link.name}</span>
              {link.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {link.badge > 99 ? '99+' : link.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* My Tasks widget */}
        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setMyTasksOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <span className="flex items-center gap-2 uppercase tracking-wider">
              <CheckSquare size={13} /> My Tasks
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${myTasksOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {myTasksOpen && (
            <div className="mt-1">
              <MyTasksWidget />
            </div>
          )}
        </div>
      </div>

      {/* Admin Portal link — only visible to Admin role */}
      {user?.role === 'Admin' && (
        <div className="px-4 pb-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <NavLink
            to="/admin/users"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ` +
              (isActive
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100')
            }
          >
            <Shield className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
            Admin Portal
          </NavLink>
        </div>
      )}

      {/* Bottom nav */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <NavLink
          to="/settings"
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ` +
            (isActive
              ? 'bg-blue-50 dark:bg-crmAccent/15 text-crmHover dark:text-crmAccent'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60')
          }
        >
          <Settings className="w-[18px] h-[18px] mr-3" />
          Settings
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
        >
          <LogOut className="w-[18px] h-[18px] mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-crmDark flex transition-colors duration-200">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:pl-64 h-screen">

        {/* Top Header */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-crmCard/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <button className="lg:hidden p-2 -ml-2 text-slate-500" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            {/* Search trigger */}
            <button
              onClick={openSearch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Search</span>
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-slate-400">
                <span>⌘</span><span>K</span>
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-4" ref={notifRef}>
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors relative p-1"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-crmCard" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-crmCard rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Recent Activity</h3>
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-8">No recent activity</p>
                    ) : (
                      notifications.map((n, i) => {
                        const Icon = n.Icon;
                        return (
                          <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[n.type]}`}>
                              <Icon size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{n.label}</p>
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{n.sub}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                    <p className="text-xs text-center text-slate-400">Showing most recent activity</p>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <NavLink to="/profile" title="My Profile">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-crmAccent to-indigo-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-crmAccent hover:ring-offset-2 transition-all">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBot />
      <GlobalSearch />
    </div>
  );
};

export default Layout;
