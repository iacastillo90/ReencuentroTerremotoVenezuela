import React, { useState } from 'react';
import { ShieldAlert, Users, Flame, CloudRain, Zap, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
import type { MapLayers } from './MapFilters';
import './MapLegend.css';

interface MapLegendProps {
  layers: MapLayers;
  onToggleLayer: (layer: keyof MapLayers) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({ layers, onToggleLayer }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Mobile: collapsed by default, Desktop overrides via CSS or just start false and expand? Let's start true so it shows on load.
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-collapse after 5 seconds on mobile if no interaction
  React.useEffect(() => {
    if (window.innerWidth <= 768 && !hasInteracted) {
      const timer = setTimeout(() => setIsExpanded(false), 4000);
      return () => clearTimeout(timer);
    }
    // On desktop, keep expanded
    if (window.innerWidth > 768) {
      setIsExpanded(true);
    }
  }, [hasInteracted]);

  const toggle = () => {
    setIsExpanded(!isExpanded);
    setHasInteracted(true);
  };

  return (
    <div className={`map-legend ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="legend-header" onClick={toggle}>
        <div className="legend-header-title">
          <MapIcon size={16} />
          <h4 className="legend-title">Leyenda</h4>
        </div>
        <button className="legend-toggle-btn">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
      
      <div className="legend-content">
        <div className={`legend-item ${layers.persons ? 'active' : 'inactive'}`} onClick={() => onToggleLayer('persons')}>
          <div className="legend-icon marker-person">
            <Users size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Personas</span>
            <span className="legend-source">CNE, ReencuentroVE</span>
          </div>
        </div>

        <div className={`legend-item ${layers.earthquake ? 'active' : 'inactive'}`} onClick={() => onToggleLayer('earthquake')}>
          <div className="legend-icon marker-quake">
            <ShieldAlert size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Sismos</span>
            <span className="legend-source">FUNVISIS</span>
          </div>
        </div>
        
        <div className={`legend-item ${layers.flood ? 'active' : 'inactive'}`} onClick={() => onToggleLayer('flood')}>
          <div className="legend-icon marker-flood">
            <CloudRain size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Lluvias</span>
            <span className="legend-source">INAMEH</span>
          </div>
        </div>

        <div className={`legend-item ${layers.social ? 'active' : 'inactive'}`} onClick={() => onToggleLayer('social')}>
          <div className="legend-icon marker-zap">
            <Zap size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Servicios y Rescate</span>
            <span className="legend-source">CORPOELEC, Cruz Roja, Prot. Civil</span>
          </div>
        </div>

        <div className={`legend-item ${layers.fire ? 'active' : 'inactive'}`} onClick={() => onToggleLayer('fire')}>
          <div className="legend-icon marker-fire">
            <Flame size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Incendios</span>
            <span className="legend-source">NASA FIRMS</span>
          </div>
        </div>

        <div className="legend-footer">
          Toca los iconos para filtrar el mapa.
        </div>
      </div>
    </div>
  );
};
