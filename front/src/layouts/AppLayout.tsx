import React, { useState } from 'react';
import {
  PlusCircle, Settings, Map, BookOpen, X, User as UserIcon, LogOut,
  Home, Search, MoreHorizontal, ShieldCheck, Building2, Truck, LogIn
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { BrandMark } from '../components/BrandMark';
import './AppLayout.css';

type View =
  | 'home' | 'feed' | 'search' | 'map' | 'report' | 'admin' | 'library'
  | 'profile' | 'logistics' | 'login' | 'register' | 'manual' | 'directorio';

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
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, logout } = useAuth();

  // Navegación principal (5 ítems en móvil): Inicio · Buscar · Reportar · Mapa · Más
  const primaryNav: { view: View; icon: React.ReactNode; label: string }[] = [
    { view: 'home',   icon: <Home size={22} />,   label: 'Inicio' },
    { view: 'search', icon: <Search size={22} />, label: 'Buscar' },
    { view: 'map',    icon: <Map size={22} />,    label: 'Mapa' },
  ];

  // Destinos secundarios agrupados en "Más"
  const moreNav: { view: View; icon: React.ReactNode; label: string; desc: string }[] = [
    { view: 'directorio', icon: <Building2 size={20} />,   label: 'Directorio de apoyo', desc: 'Organizaciones verificadas' },
    { view: 'manual',     icon: <ShieldCheck size={20} />, label: 'Manual y políticas',  desc: 'Actuación sísmica y seguridad' },
    { view: 'library',    icon: <BookOpen size={20} />,    label: 'Guías y recursos',    desc: 'Biblioteca de ayuda' },
    { view: 'logistics',  icon: <Truck size={20} />,       label: 'Logística',           desc: 'Refugios y vías' },
    { view: 'profile',    icon: <UserIcon size={20} />,    label: 'Mi perfil',           desc: 'Tus reportes y mensajes' },
  ];

  const go = (view: View) => { setMoreOpen(false); onViewChange(view); };

  return (
    <div className="app-shell">
      {/* ─ Top Navbar ─ */}
      <nav className="navbar">
        <button className="nav-brand" onClick={() => onViewChange('home')} aria-label="Inicio">
          <BrandMark size={34} />
          <span className="nav-brand-text">
            <strong>Reencuentros<span>Venezuela</span></strong>
            <small>Juntos te encontramos</small>
          </span>
        </button>

        {/* Nav de escritorio */}
        <div className="nav-toggle-pills">
          <button className={`toggle-pill ${activeView === 'home' ? 'active' : ''}`} onClick={() => onViewChange('home')}>
            <Home size={14} /> Inicio
          </button>
          <button className={`toggle-pill ${activeView === 'search' || activeView === 'feed' ? 'active' : ''}`} onClick={() => onViewChange('search')}>
            <Search size={14} /> Buscar
          </button>
          <button className={`toggle-pill ${activeView === 'map' ? 'active' : ''}`} onClick={() => onViewChange('map')}>
            <Map size={14} /> Mapa
          </button>
          <button className={`toggle-pill ${activeView === 'directorio' ? 'active' : ''}`} onClick={() => onViewChange('directorio')}>
            <Building2 size={14} /> Directorio
          </button>
          <button className={`toggle-pill ${activeView === 'manual' ? 'active' : ''}`} onClick={() => onViewChange('manual')}>
            <ShieldCheck size={14} /> Manual
          </button>
        </div>

        <div className="nav-actions">
          <span className="sos-pill hide-mobile" title="Canal de emergencia activo">
            <span className="sos-dot" /> Canal SOS
          </span>
          {user ? (
            <div className="nav-user">
              <UserIcon size={18} />
              <span className="hide-mobile nav-user-name">{user.name.split(' ')[0]}</span>
              <button className="btn-icon" onClick={logout} title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn-icon hide-mobile" onClick={() => onViewChange('login')} title="Iniciar sesión">
              <LogIn size={17} />
            </button>
          )}
          {user?.role === 'admin' && (
            <button className="btn-icon" onClick={onAdmin} title="Administración">
              <Settings size={17} />
            </button>
          )}
          <button className="btn-report" onClick={onReport}>
            + Reportar
          </button>
        </div>
      </nav>

      {/* ─ Body ─ */}
      <div className="app-body">
        {sidebar && <aside className="sidebar">{sidebar}</aside>}
        <main className="content-area">
          {children}
        </main>
      </div>

      {/* ─ Bottom Nav — móvil (5 ítems) ─ */}
      <nav className="bottom-nav">
        {primaryNav.slice(0, 2).map(item => (
          <button
            key={item.view}
            className={`bottom-nav-item ${activeView === item.view ? 'active' : ''}`}
            onClick={() => go(item.view)}
          >
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
        <button className="bottom-nav-item nav-item-center" onClick={onReport} aria-label="Reportar">
          <PlusCircle size={30} />
          <span>Reportar</span>
        </button>
        <button
          className={`bottom-nav-item ${activeView === 'map' ? 'active' : ''}`}
          onClick={() => go('map')}
        >
          <Map size={22} /><span>Mapa</span>
        </button>
        <button
          className={`bottom-nav-item ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={22} /><span>Más</span>
        </button>
      </nav>

      {/* ─ Hoja "Más" ─ */}
      {moreOpen && (
        <div className="drawer-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={e => e.stopPropagation()}>
            <div className="more-sheet-head">
              <strong>Más opciones</strong>
              <button className="btn-icon" onClick={() => setMoreOpen(false)}><X size={18} /></button>
            </div>
            <div className="more-grid">
              {moreNav.map(item => (
                <button key={item.view} className="more-item" onClick={() => go(item.view)}>
                  <span className="more-item-ico">{item.icon}</span>
                  <span className="more-item-text">
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="more-sheet-foot">
              {user ? (
                <button className="more-auth-btn" onClick={() => { setMoreOpen(false); logout(); }}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              ) : (
                <button className="more-auth-btn primary" onClick={() => go('login')}>
                  <LogIn size={18} /> Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
