/**
 * TabReports.tsx — Lista de reportes del usuario
 *
 * PROPÓSITO:
 *   Muestra los reportes (personas) que el usuario ha creado.
 *   Cada reporte es una card con:
 *   - Nombre y badge de estado (En búsqueda / Encontrado).
 *   - Fecha de actualización.
 *   - Descripción de la última vez visto.
 *   - Click → abre PersonDetailModal (via onSelectPerson).
 *
 * ESTADOS:
 *   - loading: muestra mensaje de carga.
 *   - empty (myReports.length === 0): "Aún no has creado ningún reporte".
 *   - list: cards de reportes.
 *
 * NOTA:
 *   No usa EmptyState/LoadingScreen de common porque los estilos
 *   del perfil son diferentes a los del admin. Usa clases propias
 *   (.profile-loading, .profile-empty).
 */
import { FileText, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../store/AuthContext';
import type { Person } from '../../../types';

interface Props {
  myReports: Person[];
  loading: boolean;
  onSelectPerson: (p: Person) => void;
}

export function TabReports({ myReports, loading, onSelectPerson }: Props) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="profile-content">
      <h3><FileText size={18} /> Mis reportes ({myReports.length})</h3>

      {loading ? (
        <div className="profile-loading">Cargando reportes...</div>
      ) : myReports.length === 0 ? (
        <div className="profile-empty">
          <p>Aún no has creado ningún reporte.</p>
        </div>
      ) : (
        <div className="my-reports-list">
          {myReports.map(person => (
            <div key={person.idHash}
              className="report-card"
              onClick={() => onSelectPerson(person)}>
              {/* Header: nombre + badge de estado */}
              <div className="report-card-header">
                <h4>{person.name}</h4>
                <span className={`status-badge ${person.status === 'missing' ? 'missing' : 'found'}`}>
                  {person.status === 'missing' ? 'En búsqueda' : 'Encontrado'}
                </span>
              </div>

              {/* Body: última actualización + descripción */}
              <div className="report-card-body">
                <p>
                  <Clock size={12} /> Actualizado:{' '}
                  {new Date(person.metadata.createdAt || '').toLocaleDateString('es-VE')}
                </p>
                <p className="report-desc">
                  {person.lastSeen?.description || person.description}
                </p>
              </div>

              {/* Footer: call to action */}
              <div className="report-card-footer">
                <span>Ver detalles <ArrowRight size={14} /></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
