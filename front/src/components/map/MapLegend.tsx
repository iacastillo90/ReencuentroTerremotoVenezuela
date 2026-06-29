import React from 'react';
import { ShieldAlert, Users, Flame } from 'lucide-react';
import './MapLegend.css';

export const MapLegend: React.FC = () => {
  return (
    <div className="map-legend">
      <h4 className="legend-title">Leyenda del Mapa</h4>
      
      <div className="legend-item">
        <div className="legend-icon marker-person">
          <Users size={14} />
        </div>
        <div className="legend-info">
          <span className="legend-label">Personas (Busco/Vi)</span>
          <span className="legend-source">Fuentes: CNE, ReencuentroVE</span>
        </div>
      </div>

      <div className="legend-item">
        <div className="legend-icon marker-quake">
          <ShieldAlert size={14} />
        </div>
        <div className="legend-info">
          <span className="legend-label">Sismos Recientes</span>
          <span className="legend-source">Fuente Oficial: FUNVISIS</span>
        </div>
      </div>
      
      <div className="legend-item">
        <div className="legend-icon marker-fire">
          <Flame size={14} />
        </div>
        <div className="legend-info">
          <span className="legend-label">Incendios / Calor</span>
          <span className="legend-source">Fuente Oficial: NASA FIRMS</span>
        </div>
      </div>

      <div className="legend-footer">
        Datos públicos con caché offline habilitado.
      </div>
    </div>
  );
};
