import React, { useContext, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  Bell
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Layout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define our application route mappings
  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Accounts', path: '/accounts', icon: Building2 },
    { name: 'Contacts', path: '/contacts', icon: Users },
    { name: 'Opportunities', path: '/opportunities', icon: BarChart3 },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Reusable Sidebar content component
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-crmCard border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
      
      {/* Brand logo area */}
      <div className="h-16 flex items-center justify-center px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-crmAccent font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-crmAccent flex items-center justify-center text-white shadow-sm">
            <BarChart3 size={20} strokeWidth={2.5} />
          </div>
          CRMHUB
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) => 
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ` +
                (isActive 
                  ? `bg-blue-50 dark:bg-crmAccent/15 text-crmHover dark:text-crmAccent` 
                  : `text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100`)
              }
              end={link.path === '/'}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
              {link.name}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom section (Settings & Logout) */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <button className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200">
          <Settings className="w-[18px] h-[18px] mr-3" />
          Settings
        </button>
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
      
      {/* Desktop Sidebar (Fixed left, hidden on small screens) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar overlay & drawer */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <div className="fixed inset-y-0 left-0 w-64 flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 h-screen">
        
        {/* Top Header */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-crmCard/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
          
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-5">
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-crmCard"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-crmAccent to-indigo-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content inside the Layout */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default Layout;
