import React from 'react';
import { Home, PlusCircle, Search, Building2, ShieldCheck, Plus } from 'lucide-react';

export type BottomNavView = 'home' | 'search' | 'directorio' | 'manual';

interface MobileBottomNavProps {
  activeView?: BottomNavView | 'report' | string;
  onNavigate: (view: BottomNavView) => void;
  onReport: (e: React.MouseEvent) => void;
  moreOpen?: boolean;
  onMoreClick: (e: React.MouseEvent) => void;
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  onReport,
  moreOpen,
  onMoreClick,
  className = ''
}) => {
  return (
    <nav className={`bottom-nav ${className}`.trim()}>
      <button className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onNavigate('home'); }}>
        <Home size={28} strokeWidth={2.2} fill={activeView === 'home' ? 'currentColor' : 'none'} /><span>Inicio</span>
      </button>
      <button className={`bottom-nav-item nav-item-report ${activeView === 'report' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onReport(e); }} aria-label="Reportar">
        <PlusCircle size={36} strokeWidth={2.5} fill="currentColor" /><span>Reportar</span>
      </button>
      <button className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onNavigate('search'); }}>
        <Search size={28} strokeWidth={2.2} /><span>Buscar</span>
      </button>
      <button className={`bottom-nav-item ${activeView === 'directorio' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onNavigate('directorio'); }}>
        <Building2 size={28} strokeWidth={2.2} fill={activeView === 'directorio' ? 'currentColor' : 'none'} /><span>Directorio</span>
      </button>
      <button className={`bottom-nav-item ${activeView === 'manual' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onNavigate('manual'); }}>
        <ShieldCheck size={28} strokeWidth={2.2} fill={activeView === 'manual' ? 'currentColor' : 'none'} /><span>Manual</span>
      </button>
      <button className={`bottom-nav-item ${moreOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onMoreClick(e); }}>
        <Plus size={28} strokeWidth={2.2} /><span>Más</span>
      </button>
    </nav>
  );
};
