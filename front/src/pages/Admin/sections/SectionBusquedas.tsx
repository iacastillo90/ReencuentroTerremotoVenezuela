/**
 * SectionBusquedas.tsx — Solicitudes de búsqueda de familiares
 *
 * PROPÓSITO:
 *   Muestra una tabla con todas las solicitudes de búsqueda que
 *   los familiares han creado. Cada solicitud incluye:
 *   - Nombre de la persona buscada.
 *   - Descripción/contexto de la desaparición.
 *   - Datos de contacto del familiar que creó la solicitud.
 *   - Estado (activa, resuelta, cerrada).
 *
 * CARGA DE DATOS:
 *   Se llama a GET /admin/searches al montar el componente.
 *   El resultado se guarda en searches[].
 *
 * FILTRO:
 *   Se muestra un badge con el conteo de solicitudes activas
 *   en el header de la sección.
 *
 * NOTA:
 *   Los datos de usuario vienen poblados (populate) desde la API:
 *   s.user.name y s.user.email. Si el usuario fue eliminado,
 *   se muestra "Desconocido" / "Sin email".
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, Users } from 'lucide-react';
import { api } from '../../../services/api';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';

export function SectionBusquedas() {
  const [searches, setSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // load: obtiene las solicitudes del backend.
  // useCallback para evitar loops infinitos con useEffect.
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/searches');
      setSearches(res.data);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error cargando búsquedas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen text="Cargando búsquedas..." />;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><Search size={18} /> Solicitudes de Búsqueda (Familiares)</h3>
        {/* Badge que muestra cuántas solicitudes están activas */}
        <span className="admin-badge pending">
          {searches.filter(s => s.status === 'activa').length} Activas
        </span>
      </div>

      {errorMsg && <div className="admin-error-text">{errorMsg}</div>}

      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Persona Buscada</th>
              <th>Descripción</th>
              <th>Familiar / Contacto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {searches.map(s => (
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
              </tr>
            ))}
            {searches.length === 0 && (
              <tr><td colSpan={4}><EmptyState message="No hay búsquedas registradas" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
