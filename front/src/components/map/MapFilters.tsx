import React from 'react';
import { Users, ShieldAlert, CloudRain, Flame, Zap } from 'lucide-react';
import './MapFilters.css';

export type MapLayers = {
  persons: boolean;
  earthquake: boolean; // FUNVISIS
  flood: boolean;      // INAMEH
  fire: boolean;       // NASA FIRMS
  social: boolean;     // CORPOELEC
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
