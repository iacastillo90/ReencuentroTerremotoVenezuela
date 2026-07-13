import { useState, useEffect, useCallback } from 'react';
import { Activity, ShieldAlert, ArrowRight, Loader2, Database } from 'lucide-react';
import { api } from '../../../services/api';
import { EmptyState } from '../../../components/common/EmptyState';
import { LoadingScreen } from '../../../components/common/LoadingScreen';

interface AuditLogEntry {
  _id: string;
  eventType: string;
  severity: string;
  actor: string;
  action: string;
  resource?: string;
  detail?: any;
  ip: string;
  timestamp: string;
}

export function SectionAuditoria() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Solo pedimos las auto fusiones por ahora
      const res = await api.get('/admin/audit-logs?eventType=system_action');
      setLogs(res.data.data || []);
      setErrorMsg('');
    } catch (e) {
      console.error(e);
      setErrorMsg('Error al cargar el registro de auditoría.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  if (loading) return <LoadingScreen text="Cargando registro de auditoría..." />;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><Activity size={18} /> Auditoría de Fusiones y Sistema</h3>
        <span className="admin-badge pending">{logs.length} Registros</span>
      </div>

      {errorMsg && (
        <div className="admin-error-banner" style={{ margin: '1rem 0' }}>
          <ShieldAlert size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Acción del Sistema</th>
              <th>Recurso / ID Hash</th>
              <th>Detalle Forense (Original → Nuevo)</th>
              <th>IP Origen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span className={`admin-badge ${log.severity === 'warning' ? 'missing' : 'found'}`}>
                    {log.action.toUpperCase()}
                  </span>
                </td>
                <td>
                  <code style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>
                    {log.resource?.slice(0, 16)}...
                  </code>
                </td>
                <td>
                  {log.action === 'auto_merge' && log.detail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#ef4444' }}>{log.detail.incomingName || 'Desconocido'}</strong>
                        <ArrowRight size={14} color="#6b7280" />
                        <strong style={{ color: '#22c55e' }}>{log.detail.matchedName}</strong>
                      </div>
                      <small style={{ color: '#9ca3af' }}>
                        <Database size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/>
                        Razón: {log.detail.reason} (Score: {(log.detail.score * 100).toFixed(1)}%)
                      </small>
                    </div>
                  ) : (
                    <pre style={{ fontSize: '0.8rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(log.detail, null, 2)}
                    </pre>
                  )}
                </td>
                <td>
                  <code style={{ fontSize: '0.85rem' }}>{log.ip}</code>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState message="No hay eventos de auditoría registrados" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
