import React from 'react';
import { Sparkles } from 'lucide-react';

interface ModeToggleProps {
  modo: 'manual' | 'ia';
  setModo: (m: 'manual' | 'ia') => void;
  onIaClick?: () => void;
  style?: React.CSSProperties;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ modo, setModo, onIaClick, style }) => (
  <div className="figma-toggle" style={style || { margin: '0 auto 16px auto' }}>
    <button type="button" onClick={() => setModo('manual')}
      className={`figma-toggle-btn ${modo === 'manual' ? 'active' : ''}`}>
      Manual
    </button>
    <button type="button" onClick={() => { setModo('ia'); if (onIaClick) onIaClick(); }}
      className={`figma-toggle-btn ${modo === 'ia' ? 'active' : ''}`}>
      <Sparkles size={16} /> Con IA
    </button>
  </div>
);
