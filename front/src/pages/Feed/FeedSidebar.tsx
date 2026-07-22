import React from 'react';
import { AlertTriangle, Users, MapPin } from 'lucide-react';
import type { Person, Disaster } from '../../types';

interface Counts { missing: number; found: number; total: number; }

export const FeedSidebar: React.FC<{
  persons: Person[];
  disasters: Disaster[];
  total: number;
  counts: Counts;
}> = ({ disasters, total, counts }) => (
  <div className="sidebar-panel">
    <div className="sidebar-stats">
      <div className="sidebar-stat danger">
        <AlertTriangle size={20} />
        <div>
          <h4>{counts.missing.toLocaleString()}</h4>
          <p>Desaparecidos</p>
        </div>
      </div>
      <div className="sidebar-stat success">
        <Users size={20} />
        <div>
          <h4>{counts.found.toLocaleString()}</h4>
          <p>Encontrados</p>
        </div>
      </div>
      <div className="sidebar-stat primary">
        <MapPin size={20} />
        <div>
          <h4>{disasters.length}</h4>
          <p>Alertas Activas</p>
        </div>
      </div>
      <div className="sidebar-stat sidebar-stat-amber">
        <span className="sidebar-stat-icon-large">🗄️</span>
        <div>
          <h4>{total.toLocaleString()}</h4>
          <p>Total en BD</p>
        </div>
      </div>
    </div>

    <p className="sidebar-panel-footer">
      Plataforma de búsqueda y reencuentro de personas afectadas por el terremoto en Venezuela.
      Todos los reportes son públicos para maximizar la visibilidad.
    </p>
  </div>
);
