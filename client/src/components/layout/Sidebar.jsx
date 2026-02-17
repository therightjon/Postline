import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  Users,
  LogOut,
  Zap,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compose', icon: PenSquare, label: 'Create Post' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside data-sidebar className="pl-sidebar">
      <header className="pl-sidebar-header">
        <div className="pl-sidebar-logo">
          <Zap size={20} />
          <span className="pl-sidebar-brand">Postline</span>
        </div>
        <ThemeToggle />
      </header>

      <nav>
        <ul className="pl-sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={`pl-sidebar-link ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="pl-sidebar-footer">
        <div className="pl-sidebar-user">
          <div className="pl-sidebar-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="pl-sidebar-user-info">
            <span className="pl-sidebar-user-name">{user?.name || 'User'}</span>
            <span className="pl-sidebar-user-email">{user?.email || ''}</span>
          </div>
        </div>
        <button className="ghost small" onClick={logout} title="Sign out" style={{ padding: '6px' }}>
          <LogOut size={16} />
        </button>
      </footer>
    </aside>
  );
}
