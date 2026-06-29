import React from 'react';
import { ShieldAlert, MapPin, AlertTriangle, Truck } from 'lucide-react';
import type { Disaster } from '../../types';
import './LogisticsPage.css';

interface LogisticsPageProps {
  disasters: Disaster[];
}

export const LogisticsPage: React.FC<LogisticsPageProps> = ({ disasters }) => {
  // Filtramos solo los de Protección Civil y Cruz Roja (o tipos específicos)
  const logistics = disasters.filter(d => 
    d.source === 'proteccion-civil-gov' || 
    d.source === 'cruz-roja-ve' ||
    d.metadata?.subType === 'refugio' || 
    d.metadata?.subType === 'via_cerrada'
  );

  const getIcon = (source: string, type: string) => {
    if (source === 'proteccion-civil-gov' && type === 'social') return <ShieldAlert size={20} />;
    if (type === 'landslide') return <AlertTriangle size={20} />;
    if (source === 'cruz-roja-ve') return <MapPin size={20} />;
    return <Truck size={20} />;
  };

  return (
    <div className="logistics-page">
      <div className="logistics-header">
        <h2>Logística y Ayuda</h2>
        <p>Centros de acopio, vías bloqueadas y refugios. Esta vista está optimizada para bajo consumo de datos y batería (Modo Offline).</p>
      </div>

      {logistics.length === 0 ? (
        <div className="logistics-empty">
          No hay alertas logísticas recientes.
        </div>
      ) : (
        <div className="logistics-grid">
          {logistics.map(item => (
            <div key={item._id} className={`logistics-card source-${item.source}`}>
              <div className="card-icon">
                {getIcon(item.source, item.type)}
              </div>
              <div className="card-content">
                <div className="card-title-row">
                  <h3>{item.title}</h3>
                  <span className={`severity-badge sev-${item.severity}`}>
                    {item.severity.toUpperCase()}
                  </span>
                </div>
                <p className="card-desc">{item.description}</p>
                <div className="card-meta">
                  <span className="card-source">Fuente: {item.source.replace('-gov', '').replace('-ve', '').toUpperCase()}</span>
                  <span className="card-date">{new Date(item.occurredAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
