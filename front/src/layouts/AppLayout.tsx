import React, { useState } from 'react';
import { PlusCircle, Settings, Menu, Map, Users, BookOpen, X, User as UserIcon, LogOut, Home, Heart, Truck } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import './AppLayout.css';

type View = 'feed' | 'map' | 'report' | 'admin' | 'library' | 'profile' | 'logistics';

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

  const navItems: { view: View; icon: React.ReactNode; label: string; center?: boolean }[] = [
    { view: 'feed',   icon: <Home size={22} />,     label: 'Inicio' },
    { view: 'map',    icon: <Map size={22} />,      label: 'Mapa' },
    { view: 'report', icon: <PlusCircle size={32} color="var(--clr-primary)" fill="rgba(59,130,246,0.2)" />, label: '', center: true },
    { view: 'library',icon: <BookOpen size={22} />, label: 'Guías' },
    { view: 'logistics', icon: <Truck size={22} />, label: 'Ayuda' },
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

          <div className="nav-logo-icon" style={{ background: 'transparent', display: 'flex', alignItems: 'center' }}>
            <Heart size={20} color="#f59e0b" fill="var(--clr-danger)" style={{ marginRight: '-8px', zIndex: 1 }} />
            <Heart size={20} color="var(--clr-primary)" fill="var(--clr-primary)" />
          </div>
          <div className="nav-brand-text">
            <h1>Reencuentros<span>Venezuela</span></h1>
          </div>
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
          <button
            className={`toggle-pill ${activeView === 'library' ? 'active' : ''}`}
            onClick={() => onViewChange('library')}
          >
            <BookOpen size={14} style={{ display: 'inline', marginRight: 6 }} />
            Guías
          </button>
          <button
            className={`toggle-pill ${activeView === 'logistics' ? 'active' : ''}`}
            onClick={() => onViewChange('logistics')}
          >
            <Truck size={14} style={{ display: 'inline', marginRight: 6 }} />
            Ayuda
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
            className={`bottom-nav-item ${activeView === item.view ? 'active' : ''} ${item.center ? 'nav-item-center' : ''}`}
            onClick={() => handleBottomNav(item.view)}
          >
            {item.icon}
            {item.label && <span>{item.label}</span>}
          </button>
        ))}
        <button className={`bottom-nav-item ${activeView === 'profile' ? 'active' : ''}`} onClick={() => handleBottomNav('profile' as any)}>
          <UserIcon size={22} />
          <span>Perfil</span>
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
