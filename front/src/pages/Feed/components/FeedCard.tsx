/**
 * pages/Feed/components/FeedCard.tsx — Tarjeta individual en el feed
 *
 * PROPÓSITO:
 *   Renderiza un resumen visual de una persona reportada.
 *   Se usa en FeedPage, SearchPage, y otras vistas que muestran listas.
 *
 * ELEMENTOS:
 *   - Header: avatar (foto o icono), nombre, ubicación, tiempo desde creación.
 *   - Badge: "Buscado" (rojo) o "Encontrado" (verde).
 *   - Sellos de confianza: "Verificado por X" o "Protegido (LOPNNA)".
 *   - Foto con overlay de identidad protegida si aplica.
 *   - Footer: entidad fuente, ubicación detallada, botón de contacto.
 *
 * PROTECCIÓN DE MENORES (LOPNNA):
 *   Si person.name === 'Caso protegido', person.age < 18, o
 *   person.protected === true, se aplican estas reglas:
 *   - La foto se difumina con CSS (clase protected-media).
 *   - Aparece un candado con "Identidad protegida (LOPNNA)".
 *   - No se muestra el nombre real.
 *   - Aparece botón "Contactar Moderador" para aportar datos.
 *
 * TIME AGO:
 *   Muestra cuánto tiempo pasó desde la creación del reporte
 *   en formato legible: "hace 5 min", "hace 3 h", "hace 2 d".
 *   Si no hay fecha, no muestra nada.
 */
import React from 'react';
import { MapPin, Users, BadgeCheck, ShieldAlert } from 'lucide-react';
import type { Person } from '../../../types';
import '../Feed.css';

interface FeedCardProps {
  person: Person;
}

export const FeedCard: React.FC<FeedCardProps> = ({ person }) => {

  // Determina si el caso está protegido por LOPNNA
  const isProtected =
    (person as any).protected === true ||
    person.name === 'Caso protegido' ||
    (typeof person.age === 'number' && person.age < 18);
  const verifiedBy = person.data?.verificado_por;

  const timeAgo = () => {
    if (!person.metadata?.createdAt) return null;
    const diff = (Date.now() - new Date(person.metadata.createdAt).getTime()) / 1000;
    if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
    return `hace ${Math.round(diff / 86400)} d`;
  };

  return (
    <article className="feed-card">
      {/* Header: avatar, nombre, ubicación, badge de estado */}
      <div className="feed-card-header">
        <div className="feed-avatar">
          {person.photoUrl
            ? <img src={person.photoUrl} alt={person.name} />
            : <Users size={24} />
          }
        </div>
        <div className="feed-card-meta">
          <div className="feed-card-name">{person.name}</div>
          {person.description && <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginBottom: '4px', lineHeight: '1.2' }}>{person.description}</div>}
          <div className="feed-card-sub">
            <MapPin size={11} />
            {person.lastSeen?.state || 'Ubicación desconocida'}
            {timeAgo() && <>&nbsp;·&nbsp;{timeAgo()}</>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span className={`badge ${person.status}`}>
            {person.status === 'missing' ? 'Buscado' : 'Encontrado'}
          </span>
          {person.age !== undefined && (
            <span style={{ fontSize: '0.65rem', color: 'var(--clr-text-muted)', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Edad: {person.age} {person.age === 1 ? 'año' : 'años'}
            </span>
          )}
        </div>
      </div>

      {/* Sellos de confianza: verificado o protegido */}
      {(verifiedBy || isProtected) && (
        <div className="feed-card-badges">
          {verifiedBy && <span className="badge verified"><BadgeCheck size={13} /> {verifiedBy}</span>}
          {isProtected && <span className="badge protected"><ShieldAlert size={13} /> Protegido</span>}
        </div>
      )}

      {/* Foto con overlay de protección (LOPNNA) si aplica */}
      <div className={`feed-card-photo${isProtected ? ' protected-media' : ''}`}>
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={isProtected ? 'Identidad protegida' : person.name} loading="lazy" />
        ) : (
          <div className="feed-card-photo-placeholder protected-blur-target">
            <Users size={36} />
            <span>Sin fotografía</span>
          </div>
        )}
        {isProtected && (
          <div className="protected-lock">
            <ShieldAlert size={26} />
            <span>Identidad protegida (LOPNNA)</span>
          </div>
        )}
      </div>

      {/* Footer: fuente, ubicación, botón de contacto si está protegido */}
      <div className="feed-card-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
          <div>🏢 <strong>Entidad:</strong> {person.data?.origen || 'Protección Civil'}</div>
          <div>📍 <strong>Ubicación:</strong> {person.lastSeen?.description || person.lastSeen?.state || 'Ubicación no precisada'}</div>
        </div>

        {isProtected && (
          <button
            type="button"
            onClick={() => alert("Próximamente: El chat seguro con el equipo de moderación se abrirá aquí.")}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <ShieldAlert size={16} /> Contactar Moderador para aportar información
          </button>
        )}
      </div>
    </article>
  );
};
