import React, { useState } from 'react';
import {
  PlusCircle, Settings, Map, BookOpen, X, User as UserIcon, LogOut,
  Home, Search, MoreHorizontal, ShieldCheck, Building2, Truck, LogIn, ChevronDown, Plus
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/ui/Button';
import { MobileBottomNav } from './MobileBottomNav';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Navegación principal (5 ítems en móvil): Inicio · Buscar · Reportar · Mapa · Más
  const primaryNav: { view: View; icon: React.ReactNode; label: string }[] = [
    { view: 'home',   icon: <Home size={22} />,   label: 'Inicio' },
    { view: 'search', icon: <Search size={22} />, label: 'Buscar' },
    { view: 'map',    icon: <Map size={22} />,    label: 'Mapa' },
  ];

  // Destinos secundarios agrupados en "Más"
  const moreNav: { view: View; icon: React.ReactNode; label: string; desc: string }[] = [
    { view: 'logistics',  icon: <Truck size={20} />,       label: 'Logística',           desc: 'Refugios y vías' },
    { view: 'map',        icon: <Map size={20} />,         label: 'Mapa de calor',       desc: 'Vista geográfica' },
  ];

  const go = (view: View) => { setMoreOpen(false); setUserMenuOpen(false); onViewChange(view); };
  const closeSession = () => { setMoreOpen(false); setUserMenuOpen(false); logout(); };

  return (
    <div className="app-shell">
      {/* ─ Top Navbar ─ */}
      <nav className="navbar">
        <div className="nav-left">
          <button className="nav-brand" onClick={() => onViewChange('home')} aria-label="Inicio">
            <BrandMark size={34} />
            <span className="nav-brand-text">
              <strong>Reencuentros<span>Venezuela</span></strong>
              <small>Juntos te encontramos</small>
            </span>
          </button>
        </div>

        {/* Nav de escritorio */}
        <div className="nav-toggle-pills">
          <Button variant={activeView === 'home' ? 'danger' : 'ghost'} size="sm" className="toggle-pill-override" onClick={() => onViewChange('home')}>
            <Home size={14} /> Inicio
          </Button>
          <Button variant={activeView === 'search' || activeView === 'feed' ? 'danger' : 'ghost'} size="sm" className="toggle-pill-override" onClick={() => onViewChange('search')}>
            <Search size={14} /> Buscar
          </Button>
          <Button variant={activeView === 'map' ? 'danger' : 'ghost'} size="sm" className="toggle-pill-override" onClick={() => onViewChange('map')}>
            <Map size={14} /> Mapa
          </Button>
          <Button variant={activeView === 'directorio' ? 'danger' : 'ghost'} size="sm" className="toggle-pill-override" onClick={() => onViewChange('directorio')}>
            <Building2 size={14} /> Directorio
          </Button>
          <Button variant={activeView === 'manual' ? 'danger' : 'ghost'} size="sm" className="toggle-pill-override" onClick={() => onViewChange('manual')}>
            <ShieldCheck size={14} /> Manual
          </Button>
        </div>

        <div className="nav-actions">
          <span className="sos-pill hide-mobile" title="Canal de emergencia activo">
            <span className="sos-dot" /> Canal SOS
          </span>
          {user && (
            <button className="nav-profile-mobile hide-desktop" onClick={() => go('profile')} title="Mi perfil">
              <Settings size={18} />
            </button>
          )}
          {user ? (
            <>
              <div className="nav-user-menu hide-mobile">
                <button
                  className="nav-user"
                  onClick={() => setUserMenuOpen(open => !open)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <UserIcon size={18} />
                  <span className="hide-mobile nav-user-name">{user.name.split(' ')[0]}</span>
                  <ChevronDown size={14} className="hide-mobile" />
                </button>
                {userMenuOpen && (
                  <div className="nav-user-dropdown" role="menu">
                    <button role="menuitem" onClick={() => go('profile')}>
                      <UserIcon size={16} /> Mi perfil
                    </button>
                    <button role="menuitem" onClick={closeSession}>
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={closeSession} className="flex-center hide-desktop nav-logout-mobile" title="Cerrar sesión">
                <LogOut size={20} />
              </Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={() => go('login')} className="flex-center nav-login-btn">
              <LogIn size={16} /> <span className="hide-mobile">Ingresar</span>
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outline" size="sm" className="btn-icon-override" onClick={onAdmin} title="Administración">
              <Settings size={17} />
            </Button>
          )}
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
      <MobileBottomNav
        activeView={activeView}
        onNavigate={(v) => go(v as any)}
        onReport={onReport}
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen(true)}
      />

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
                <Button fullWidth size="lg" variant="outline" onClick={closeSession} className="flex-center gap-2">
                  <LogOut size={18} /> Cerrar sesión
                </Button>
              ) : (
                <Button fullWidth size="lg" onClick={() => go('login')} className="flex-center gap-2">
                  <LogIn size={18} /> Iniciar sesión
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
