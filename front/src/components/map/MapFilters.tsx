/**
 * components/map/MapFilters.tsx — Filtros rápidos del mapa
 *
 * PROPÓSITO:
 *   Barra horizontal de chips/clicks para activar/desactivar capas del mapa.
 *   Cada chip representa una fuente de datos distinta.
 *
 * ¿POR QUÉ CHIPS EN VEZ DE CHECKBOXES?
 *   - Los chips son más táctiles (ideal para móvil).
 *   - Ocupan menos espacio horizontal.
 *   - Siguen el patrón visual de Material Design que usamos en el resto de la app.
 *
 * CAPAS DISPONIBLES:
 *   - persons:    Marcadores de personas (CNE, ReencuentroVE)
 *   - earthquake: Datos sísmicos de FUNVISIS
 *   - flood:      Alertas de lluvia del INAMEH
 *   - fire:       Focos de calor detectados por NASA FIRMS
 *   - social:     Servicios (CORPOELEC, Cruz Roja)
 *
 * FLUJO:
 *   Los filtros se pasan desde MapPage → InteractiveMap → MapFilters.
 *   onToggleLayer actualiza el estado en MapPage, que a su vez filtra
 *   los datos que se pasan al InteractiveMap.
 */
import React from 'react';
import { Users, ShieldAlert, CloudRain, Flame, Zap } from 'lucide-react';
import './MapFilters.css';

export type MapLayers = {
  persons: boolean;
  earthquake: boolean;
  flood: boolean;
  fire: boolean;
  social: boolean;
};

interface MapFiltersProps {
  layers: MapLayers;
  onToggleLayer: (layer: keyof MapLayers) => void;
}

export const MapFilters: React.FC<MapFiltersProps> = ({ layers, onToggleLayer }) => {
  return (
    <div className="map-filters-container">
      <div className="filters-scroll">

        <button
          className={`filter-chip ${layers.persons ? 'active' : ''}`}
          onClick={() => onToggleLayer('persons')}
        >
          <Users size={16} />
          <span>Personas (ReencuentroVE/CNE)</span>
        </button>

        <button
          className={`filter-chip ${layers.earthquake ? 'active' : ''} quake-chip`}
          onClick={() => onToggleLayer('earthquake')}
        >
          <ShieldAlert size={16} />
          <span>Sismos (FUNVISIS)</span>
        </button>

        <button
          className={`filter-chip ${layers.flood ? 'active' : ''} flood-chip`}
          onClick={() => onToggleLayer('flood')}
        >
          <CloudRain size={16} />
          <span>Lluvias (INAMEH)</span>
        </button>

        <button
          className={`filter-chip ${layers.social ? 'active' : ''} zap-chip`}
          onClick={() => onToggleLayer('social')}
        >
          <Zap size={16} />
          <span>Servicios (CORPOELEC)</span>
        </button>

        <button
          className={`filter-chip ${layers.fire ? 'active' : ''} fire-chip`}
          onClick={() => onToggleLayer('fire')}
        >
          <Flame size={16} />
          <span>Focos Calor (NASA FIRMS)</span>
        </button>

      </div>
    </div>
  );
};
