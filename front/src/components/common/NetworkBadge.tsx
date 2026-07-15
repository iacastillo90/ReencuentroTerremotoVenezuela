import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import './NetworkBadge.css';

export const NetworkBadge: React.FC = () => {
  const { isOnline, pendingCount } = useNetworkStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`network-badge ${isOnline ? 'syncing' : 'offline'}`}>
      <span className="network-badge-icon">
        {isOnline ? '🔄' : '📡'}
      </span>
      <span className="network-badge-text">
        {isOnline
          ? `${pendingCount} reporte${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de envío`
          : 'Sin conexión — los reportes se guardarán localmente'}
      </span>
    </div>
  );
};
