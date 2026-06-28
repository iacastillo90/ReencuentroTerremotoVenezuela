import React, { useState } from 'react';
import { MapPin, PlusCircle, Settings, Menu, Map, Users, BookOpen, X, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import './AppLayout.css';

type View = 'feed' | 'map' | 'report' | 'admin';

interface AppLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  activeView: View;
  onViewChange: (v: View) => void;
  onReport: () => void;
  onAdmin: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  sidebar,
  activeView,
  onViewChange,
  onReport,
  onAdmin
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();

  const navItems: { view: View; icon: React.ReactNode; label: string }[] = [
    { view: 'feed',   icon: <Users size={22} />,    label: 'Personas' },
    { view: 'map',    icon: <Map size={22} />,       label: 'Mapa' },
    { view: 'report', icon: <PlusCircle size={22} />, label: 'Reportar' },
  ];

  const handleBottomNav = (view: View) => {
    if (view === 'report') { onReport(); return; }
    onViewChange(view);
  };

  return (
    <div className="app-shell">
      {/* ─ Top Navbar ─ */}
      <nav className="navbar">
        <div className="nav-brand">
          {/* Hamburger visible on tablet only */}
          <button
            className="hamburger-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <div className="nav-logo-icon">
            <MapPin size={18} color="#fff" />
          </div>
          <h1>Reencuentro<span>VE</span></h1>
        </div>

        {/* View toggle pills — desktop only */}
        <div className="nav-toggle-pills">
          <button
            className={`toggle-pill ${activeView === 'feed' ? 'active' : ''}`}
            onClick={() => onViewChange('feed')}
          >
            <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
            Personas
          </button>
          <button
            className={`toggle-pill ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => onViewChange('map')}
          >
            <Map size={14} style={{ display: 'inline', marginRight: 6 }} />
            Mapa
          </button>
        </div>

        <div className="nav-actions">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem', color: 'var(--clr-text-muted)', fontSize: '0.9rem' }}>
              <UserIcon size={18} />
              <span className="hide-mobile" style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name.split(' ')[0]}</span>
              <button className="btn-icon" onClick={logout} title="Cerrar sesión" style={{ padding: '4px' }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : null}
          <button className="btn-icon" onClick={onAdmin} title="Administración">
            <Settings size={17} />
          </button>
          <button className="btn-report" onClick={onReport}>
            + Reportar
          </button>
        </div>
      </nav>

      {/* ─ Body ─ */}
      <div className="app-body">
        {/* Sidebar — desktop */}
        {sidebar && <aside className="sidebar">{sidebar}</aside>}

        {/* Main content */}
        <main className="content-area">
          {children}
        </main>
      </div>

      {/* ─ Bottom Nav — mobile ─ */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.view}
            className={`bottom-nav-item ${activeView === item.view || (item.view === 'report' && false) ? 'active' : ''}`}
            onClick={() => handleBottomNav(item.view)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button className="bottom-nav-item" onClick={onAdmin}>
          <BookOpen size={22} />
          <span>Admin</span>
        </button>
      </nav>

      {/* ─ Drawer — tablet ─ */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <strong style={{ fontSize: '1rem', color: 'var(--clr-text)' }}>Menú</strong>
              <button className="btn-icon" onClick={() => setDrawerOpen(false)}><X size={18} /></button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
};
