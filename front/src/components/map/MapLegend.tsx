/**
 * components/map/MapLegend.tsx — Leyenda interactiva del mapa
 *
 * PROPÓSITO:
 *   Panel colapsable en la esquina inferior izquierda del mapa que:
 *   1. Muestra qué capas están activas con un icono y color distintivo.
 *   2. Permite activar/desactivar capas tocando cada ítem (misma función
 *      que MapFilters, pero con más contexto visual).
 *
 * COMPORTAMIENTO RESPONSIVE:
 *   - En desktop (>768px): siempre expandido.
 *   - En móvil (≤768px): se expande al cargar, pero se colapsa tras 4
 *     segundos si el usuario no interactúa. Al tocar el header, se
 *     expande/colapsa y se cancela el auto-colapso.
 *
 * ¿POR QUÉ DUPLICAR LA FUNCIÓN DE FILTROS?
 *   - MapFilters son chips horizontales rápidos en la parte superior.
 *   - MapLegend es un panel más detallado en la esquina inferior.
 *   - El usuario puede usar el que le resulte más natural.
 *   - Ambos llaman a onToggleLayer, así que el estado está sincronizado.
 *
 * ÍTEMS DE LA LEYENDA:
 *   - Cada ítem tiene un icono con círculo de color, el nombre de la capa
 *     y la fuente de datos (para dar credibilidad).
 *   - Los ítems inactivos se atenúan (clase 'inactive').
 */
import React, { useState } from 'react';
import { ShieldAlert, Users, Flame, CloudRain, Zap, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
import type { MapLayers } from './MapFilters';
import './MapLegend.css';

interface MapLegendProps {
  layers: MapLayers;
  onToggleLayer: (layer: keyof MapLayers) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({ layers, onToggleLayer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-colapso en móvil tras 4s si el usuario no ha interactuado
  React.useEffect(() => {
    if (window.innerWidth <= 768 && !hasInteracted) {
      const timer = setTimeout(() => setIsExpanded(false), 4000);
      return () => clearTimeout(timer);
    }
    // En desktop, siempre expandido
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
        <div className={`legend-item ${layers.persons ? 'active' : 'inactive'}`}
          onClick={() => onToggleLayer('persons')}>
          <div className="legend-icon marker-person">
            <Users size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Personas</span>
            <span className="legend-source">CNE, ReencuentroVE</span>
          </div>
        </div>

        <div className={`legend-item ${layers.earthquake ? 'active' : 'inactive'}`}
          onClick={() => onToggleLayer('earthquake')}>
          <div className="legend-icon marker-quake">
            <ShieldAlert size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Sismos</span>
            <span className="legend-source">FUNVISIS</span>
          </div>
        </div>

        <div className={`legend-item ${layers.flood ? 'active' : 'inactive'}`}
          onClick={() => onToggleLayer('flood')}>
          <div className="legend-icon marker-flood">
            <CloudRain size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Lluvias</span>
            <span className="legend-source">INAMEH</span>
          </div>
        </div>

        <div className={`legend-item ${layers.social ? 'active' : 'inactive'}`}
          onClick={() => onToggleLayer('social')}>
          <div className="legend-icon marker-zap">
            <Zap size={14} />
          </div>
          <div className="legend-info">
            <span className="legend-label">Servicios y Rescate</span>
            <span className="legend-source">CORPOELEC, Cruz Roja, Prot. Civil</span>
          </div>
        </div>

        <div className={`legend-item ${layers.fire ? 'active' : 'inactive'}`}
          onClick={() => onToggleLayer('fire')}>
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
