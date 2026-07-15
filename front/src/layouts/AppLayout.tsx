/**
 * layouts/AppLayout.tsx — Estructura principal de la aplicación
 *
 * PROPÓSITO:
 *   Layout que envuelve todas las vistas (excepto Admin y Auth).
 *   Contiene:
 *   - Navbar superior: marca, navegación de escritorio (pills),
 *     SOS pill, notificaciones, menú de usuario, botón admin.
 *   - Sidebar: contenido opcional (FeedSidebar en vista feed).
 *   - Content area: la página activa (children).
 *   - MobileBottomNav: navegación inferior en móvil.
 *   - "Más" sheet: drawer con opciones secundarias (logística, mapa).
 *
 * ¿POR QUÉ UN LAYOUT?
 *   La navegación (navbar, bottom nav) debe persistir entre vistas
 *   sin re-renderizar todo el árbol. AppLayout mantiene esos
 *   elementos estables y solo cambia children.
 *
 * NOTIFICACIONES:
 *   Lee notificaciones de SocketContext (recibidas en tiempo real).
 *   Muestra badge con conteo de no leídas y dropdown con lista.
 *   Al hacer click en una notificación, navega al perfil.
 *
 * MENÚ DE USUARIO:
 *   - Desktop: dropdown con "Mi perfil" y "Cerrar sesión".
 *   - Mobile: botón avatar que navega al perfil directamente.
 */
import React, { useState } from 'react';
import {
  Settings, Map, X, User as UserIcon, LogOut,
  Home, Search, ShieldCheck, Building2, Truck, LogIn, ChevronDown, Bell, BellOff
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from '../store/SocketContext';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/ui/Button';
import { MobileBottomNav } from './MobileBottomNav';
import { NetworkBadge } from '../components/common/NetworkBadge';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
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
  children, sidebar, activeView, onViewChange, onReport, onAdmin
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotifications();
  useBackgroundSync();

  const moreNav: { view: View; icon: React.ReactNode; label: string; desc: string }[] = [
    { view: 'logistics',  icon: <Truck size={20} />,       label: 'Logística',           desc: 'Refugios y vías' },
    { view: 'map',        icon: <Map size={20} />,         label: 'Mapa de calor',       desc: 'Vista geográfica' },
  ];

  const go = (view: View) => { setMoreOpen(false); setUserMenuOpen(false); onViewChange(view); };
  const closeSession = () => { setMoreOpen(false); setUserMenuOpen(false); logout(); };

  return (
    <div className="app-shell">
      {/* ═══ Top Navbar ═══ */}
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

        <div className="nav-toggle-pills">
          {[
            { view: 'home' as View, icon: <Home size={14} />, label: 'Inicio' },
            { view: 'search' as View, icon: <Search size={14} />, label: 'Buscar' },
            { view: 'map' as View, icon: <Map size={14} />, label: 'Mapa' },
            { view: 'directorio' as View, icon: <Building2 size={14} />, label: 'Directorio' },
            { view: 'manual' as View, icon: <ShieldCheck size={14} />, label: 'Manual' },
          ].map(({ view, icon, label }) => (
            <Button key={view}
              variant={activeView === view ? 'danger' : 'ghost'} size="sm"
              className="toggle-pill-override"
              onClick={() => onViewChange(view)}>
              {icon} {label}
            </Button>
          ))}
        </div>

        <div className="nav-actions">
          <span className="sos-pill hide-mobile" title="Canal de emergencia activo">
            <span className="sos-dot" /> Canal SOS
          </span>
          {user ? (
            <>
              {/* Centro de notificaciones */}
              <div className="nav-notifications-menu">
                <button className="nav-notifications-btn"
                  onClick={() => { setNotifOpen(prev => !prev); setUserMenuOpen(false); }}
                  aria-haspopup="true" aria-expanded={notifOpen} title="Notificaciones">
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="notifications-badge" aria-live="polite">{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">
                      <h4>Notificaciones</h4>
                      <div className="notifications-actions">
                        {notifications.length > 0 && (
                          <>
                            <button onClick={markAllAsRead}>Marcar leídas</button>
                            <button onClick={clearNotifications}>Limpiar</button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="notifications-list">
                      {notifications.length === 0 ? (
                        <div className="notifications-empty">
                          <BellOff size={24} />
                          <span>No tienes notificaciones</span>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id}
                            className={`notification-item ${!notif.read ? 'unread' : ''}`}
                            onClick={() => { notif.read = true; setNotifOpen(false); go('profile'); }}>
                            <span className={`notification-accent ${notif.type}`} />
                            <strong className="notification-title">{notif.title}</strong>
                            <span className="notification-msg">{notif.message}</span>
                            <span className="notification-time">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menú de usuario desktop */}
              <div className="nav-user-menu hide-mobile">
                <button className="nav-user"
                  onClick={() => { setUserMenuOpen(open => !open); setNotifOpen(false); }}
                  aria-haspopup="menu" aria-expanded={userMenuOpen}>
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

              {/* Botón perfil mobile */}
              <button className="hide-desktop nav-profile-btn-mobile" onClick={() => go('profile')} title="Mi perfil">
                <UserIcon size={20} />
              </button>
            </>
          ) : (
            <button className="nav-profile" onClick={() => go('login')} aria-label="Ingresar">
              <div className="profile-circle">
                <UserIcon size={20} />
              </div>
            </button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outline" size="sm" className="btn-icon-override" onClick={onAdmin} title="Administración">
              <Settings size={17} />
            </Button>
          )}
        </div>
      </nav>

      <NetworkBadge />

      {/* ═══ Body ═══ */}
      <div className="app-body">
        {sidebar && <aside className="sidebar">{sidebar}</aside>}
        <main className="content-area">{children}</main>
      </div>

      {/* ═══ Bottom Nav (móvil) ═══ */}
      <MobileBottomNav activeView={activeView} onNavigate={(v) => go(v)} onReport={onReport} />

      {/* ═══ Hoja "Más" ═══ */}
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
