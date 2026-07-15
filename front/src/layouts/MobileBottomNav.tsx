/**
 * layouts/MobileBottomNav.tsx — Navegación inferior (móvil)
 *
 * PROPÓSITO:
 *   Barra de navegación fija en la parte inferior de la pantalla
 *   para dispositivos móviles. Contiene 4 botones:
 *   - Inicio (Home)
 *   - Reportar (Plus, el botón central más grande)
 *   - Buscar (Search)
 *   - Directorio (Building2)
 *
 * ¿POR QUÉ SOLO 4 ÍTEMS?
 *   Las guías de UX para mobile recomiendan máximo 5 ítems en
 *   bottom navigation. Pusimos 4 para que el botón "Reportar"
 *   destaque visualmente (es la acción principal de la app).
 *
 * ESTILO:
 *   - El botón "Reportar" es más grande (Plus de 40px) para
 *     resaltar sobre los demás.
 *   - El ítem activo se marca con clase CSS .active.
 *
 * USO:
 *   <MobileBottomNav
 *     activeView={activeView}
 *     onNavigate={(v) => go(v)}
 *     onReport={handleReport}
 *   />
 */
import React from 'react';
import { Home, Plus, Search, Building2 } from 'lucide-react';

export type BottomNavView = 'home' | 'search' | 'directorio' | 'manual';

interface MobileBottomNavProps {
  activeView?: BottomNavView | 'report' | string;
  onNavigate: (view: BottomNavView) => void;
  onReport: (e: React.MouseEvent) => void;
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView, onNavigate, onReport, className = ''
}) => {
  return (
    <nav className={`bottom-nav ${className}`.trim()}>
      <button className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onNavigate('home'); }}>
        <Home size={30} strokeWidth={2} /><span>Inicio</span>
      </button>

      <button className={`bottom-nav-item nav-item-report ${activeView === 'report' ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onReport(e); }} aria-label="Reportar">
        <Plus size={40} strokeWidth={2.5} color="currentColor" /><span>Reportar</span>
      </button>

      <button className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onNavigate('search'); }}>
        <Search size={32} strokeWidth={2} /><span>Buscar</span>
      </button>

      <button className={`bottom-nav-item ${activeView === 'directorio' ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onNavigate('directorio'); }}>
        <Building2 size={32} strokeWidth={2} /><span>Directorio</span>
      </button>
    </nav>
  );
};
