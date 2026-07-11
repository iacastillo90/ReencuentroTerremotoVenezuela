/**
 * SectionRegistros.tsx — Tabla de control de registros
 *
 * PROPÓSITO:
 *   Tabla con todos los registros de personas (desaparecidos +
 *   encontrados) que permite al administrador:
 *   1. Buscar por nombre (filtro local, no API).
 *   2. Ver estado, fuente, auditoría IA y urgencia.
 *   3. Cambiar estado entre missing ↔ found con un click.
 *
 * BÚSQUEDA LOCAL:
 *   El filtro es local (client-side) porque ya tenemos
 *   todos los datos en persons[]. No hay debounce porque
 *   no hay llamada API.
 *
 * CAMBIO DE ESTADO:
 *   changeStatus() hace PATCH /admin/persons/:idHash/status
 *   y luego actualiza el estado local via onStatusChange.
 *   Esto evita tener que recargar toda la tabla.
 *
 * PAGINACIÓN:
 *   .slice(0, 50) limita a 50 filas para no saturar el DOM.
 *   Si se necesita paginación completa, se puede agregar
 *   un sistema de páginas más adelante.
 */
import { useState } from 'react';
import { Search, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { NameCell } from '../../../components/common/NameCell';
import { EmptyState } from '../../../components/common/EmptyState';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import type { PersonRow } from '../types';

interface Props {
  persons: PersonRow[];
  loading: boolean;
  onStatusChange: (idHash: string, newStatus: string) => void;
}

export function SectionRegistros({ persons, loading, onStatusChange }: Props) {
  // search: texto del input de búsqueda local.
  const [search, setSearch] = useState('');

  // filtered: personas que coinciden con el texto de búsqueda.
  // Si search está vacío, muestra todas.
  const filtered = persons.filter(p =>
    !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  // changeStatus: llama al backend y actualiza el estado local.
  const changeStatus = async (idHash: string, newStatus: string) => {
    try {
      await api.patch(`/admin/persons/${idHash}/status`, { status: newStatus });
      onStatusChange(idHash, newStatus);
    } catch (e: any) {
      // alert es simple y no requiere librerías de toasts.
      alert(e.response?.data?.error || 'Error actualizando estado');
    }
  };

  return (
    <div className="admin-section">
      {/* Header con título y barra de búsqueda */}
      <div className="admin-section-header">
        <h3><ShieldCheck size={18} /> Control de Registros</h3>
        <div className="admin-search-bar">
          <Search size={16} color="var(--clr-text-dim)" />
          <input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        // Estado de carga
        <LoadingScreen text="Cargando registros..." />
      ) : (
        <div className="table-responsive-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estado</th>
                <th>Fuente</th>
                <th>Auditoría IA</th>
                <th>Urgencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {/* .slice(0,50) para no renderizar miles de filas */}
              {filtered.slice(0, 50).map(p => {
                const status = p.status;
                const auditStatus = p['metadata.auditStatus'] || p.metadata?.auditStatus;
                const source = p['metadata.source'] || p.metadata?.source;
                const urgency = p['metadata.urgencyScore'] ?? p.metadata?.urgencyScore ?? 0;
                const state = p.lastSeen?.state || p['lastSeen.state'] || '—';

                return (
                  <tr key={p.idHash}>
                    {/* Nombre con foto y ubicación/edad */}
                    <td>
                      <NameCell
                        name={p.name}
                        photoUrl={p.photoUrl}
                        detail={`${state}${p.age ? ` · ${p.age} años` : ''}`}
                        size={36}
                      />
                    </td>

                    {/* Badge de estado: Desaparecido/Encontrado */}
                    <td>
                      <span className={`admin-badge ${status}`}>
                        {status === 'missing' ? 'Desaparecido'
                          : status === 'found' ? 'Encontrado' : status}
                      </span>
                    </td>

                    {/* Fuente del reporte: manual o API */}
                    <td>
                      <span className={`admin-badge ${source === 'manual' ? 'manual' : 'api'}`}>
                        {source === 'manual' ? 'Reporte manual' : source || 'API'}
                      </span>
                    </td>

                    {/* Estado de auditoría IA */}
                    <td>
                      <span className={`admin-badge ${auditStatus === 'pending_review' ? 'pending' : auditStatus === 'merged' ? 'found' : 'api'}`}>
                        {auditStatus === 'pending_review' ? 'Revisión'
                          : auditStatus === 'merged' ? 'Fusionado' : 'Limpio'}
                      </span>
                    </td>

                    {/* Score de urgencia con color dinámico */}
                    <td>
                      <span className={
                        urgency > 70 ? 'admin-urgency-high'
                          : urgency > 40 ? 'admin-urgency-medium'
                          : 'admin-urgency-low'
                      }>
                        {urgency}/100
                      </span>
                    </td>

                    {/* Botones de acción: cambiar estado */}
                    <td>
                      <div className="action-buttons">
                        {status === 'missing' && (
                          <button className="btn-found"
                            onClick={() => changeStatus(p.idHash, 'found')}>
                            <CheckCircle size={14} className="admin-icon-inline" />
                            Encontrado
                          </button>
                        )}
                        {status === 'found' && (
                          <button className="btn-dismiss"
                            onClick={() => changeStatus(p.idHash, 'missing')}>
                            <XCircle size={14} className="admin-icon-inline" />
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Fila de estado vacío (sin resultados) */}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState message="Sin resultados" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
