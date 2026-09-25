import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  BarChart3,
  Settings,
  MessageSquare,
  LogOut,
  Phone,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Contacts', path: '/contacts', icon: Users },
  { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { label: 'Templates', path: '/templates', icon: FileText },
  { label: 'Inbox', path: '/inbox', icon: MessageSquare },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
];

const settingsItems = [
  { label: 'Phone Numbers', path: '/phone-numbers', icon: Phone },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">W</div>
          <span className="sidebar-brand">WA Automate</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="sidebar-section-label">Configuration</div>
          {settingsItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', fontWeight: 600, fontSize: '0.875rem'
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-tertiary truncate">{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
