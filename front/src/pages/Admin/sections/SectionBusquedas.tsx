/**
 * SectionBusquedas.tsx — Solicitudes de búsqueda de familiares
 *
 * PROPÓSITO:
 *   Tabla de solicitudes de búsqueda con paginación cliente,
 *   cambio de estado inline y caché automática via SWR.
 *
 * CARGA DE DATOS:
 *   Usa useSWR('/admin/searches', fetcher) que cachea la respuesta.
 *   Si el admin cambia de pestaña y vuelve, los datos se muestran
 *   instantáneamente desde caché (stale-while-revalidate).
 *
 * PAGINACIÓN:
 *   10 resultados por página con controles Anterior/Siguiente.
 *   Se implementa del lado del cliente (slice) para mantener
 *   compatibilidad con el backend actual.
 *
 * ACCIONES:
 *   Columna ⋮ con menú para cambiar estado de la solicitud:
 *   activa → resuelta | cerrada (PATCH /admin/searches/:id).
 *   Después del PATCH se hace mutate() para refrescar la caché.
 *
 * TIPADO:
 *   SearchRequest (types/index.ts) reemplaza any[].
 */
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../services/api';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';
import type { SearchRequest } from '../../../types';

const LIMIT = 10;
const fetcher = (url: string) => api.get(url).then(res => (res.data.searches || []) as SearchRequest[]);

export function SectionBusquedas() {
  const { data, error, isLoading, mutate } = useSWR('/admin/searches', fetcher);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const totalPages = data ? Math.ceil(data.length / LIMIT) : 0;
  const paged = data ? data.slice((page - 1) * LIMIT, page * LIMIT) : [];

  const activeCount = (data ?? []).filter(s => s.status === 'activa').length;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const updateStatus = useCallback(async (id: string, newStatus: SearchRequest['status']) => {
    const labels: Record<string, string> = { activa: 'activa', resuelta: 'resuelta', cerrada: 'cerrada' };
    if (!window.confirm(`¿Estás seguro de marcar esta solicitud como "${labels[newStatus]}"?`)) return;
    try {
      await api.patch(`/admin/searches/${id}`, { status: newStatus });
      mutate();
    } catch (e) {
      console.error('Error al actualizar estado:', e);
    }
    setOpenMenuId(null);
  }, [mutate]);

  if (isLoading) return <LoadingScreen text="Cargando búsquedas…" />;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><Search size={18} /> Solicitudes de Búsqueda (Familiares)</h3>
        <span className="admin-badge pending">{activeCount} Activas</span>
      </div>

      {error && <div className="admin-error-text">{((error as { response?: { data?: { error?: string } } }).response?.data?.error) || 'Error cargando búsquedas'}</div>}

      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Persona Buscada</th>
              <th>Descripción</th>
              <th>Familiar / Contacto</th>
              <th>Estado</th>
              <th className="srch-action-cell">{'⋮'}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(s => (
              <tr key={s._id}>
                <td>
                  <div className="name-cell">
                    <div className="person-thumb-placeholder"><Users size={16} /></div>
                    <div>
                      <strong className="admin-text-white">{s.searchName}</strong><br />
                      <small className="admin-text-muted">{s.category || 'General'}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="admin-desc-ellipsis">
                    {s.description || 'Sin descripción detallada'}
                  </div>
                </td>
                <td>
                  <div>
                    <strong className="admin-contact-name">{s.user?.name || 'Desconocido'}</strong>
                    <div className="admin-text-muted admin-contact-email">{s.user?.email || 'Sin email'}</div>
                  </div>
                </td>
                <td>
                  <span className={`admin-badge ${s.status === 'activa' ? 'pending' : s.status === 'resuelta' ? 'found' : 'missing'}`}>
                    {s.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="srch-action-cell">
                    <button
                      className="srch-action-trigger"
                      onClick={() => setOpenMenuId(openMenuId === s._id ? null : s._id)}
                      aria-label="Acciones"
                    >
                      {'⋮'}
                    </button>
                    {openMenuId === s._id && (
                      <div className="srch-action-menu">
                        <button onClick={() => updateStatus(s._id, 'resuelta')} className="srch-action-item">Marcar como resuelta</button>
                        <button onClick={() => updateStatus(s._id, 'activa')} className="srch-action-item">Marcar como activa</button>
                        <button onClick={() => updateStatus(s._id, 'cerrada')} className="srch-action-item">Marcar como cerrada</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={5}><EmptyState message="No hay búsquedas registradas" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="srch-pagination">
          <button className="srch-page-btn" disabled={!hasPrev} onClick={() => { setPage(p => p - 1); setOpenMenuId(null); }}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="srch-page-info">Página {page} de {totalPages}</span>
          <button className="srch-page-btn" disabled={!hasNext} onClick={() => { setPage(p => p + 1); setOpenMenuId(null); }}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
