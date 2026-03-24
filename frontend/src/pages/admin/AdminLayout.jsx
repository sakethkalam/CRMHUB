import { useContext } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Shield, Users, ScrollText, Settings } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

const SUB_NAV = [
  { label: 'User Management', path: '/admin/users',     icon: Users },
  { label: 'Audit Log',       path: '/admin/audit-log', icon: ScrollText },
  { label: 'System Settings', path: '/admin/settings',  icon: Settings },
];

const AdminLayout = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  // Hard guard — redirect non-admins to dashboard
  if (!user || user.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <Shield className="text-crmAccent w-7 h-7" /> Admin Portal
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage users, review activity, and configure system-wide settings.
        </p>
      </div>

      {/* Horizontal sub-nav */}
      <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-2 pt-2">
          {SUB_NAV.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors mr-1 ` +
                (isActive
                  ? 'text-crmAccent border-crmAccent bg-blue-50/60 dark:bg-crmAccent/10'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50')
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
