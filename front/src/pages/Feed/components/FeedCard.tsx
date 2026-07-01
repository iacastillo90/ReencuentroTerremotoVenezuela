import React from 'react';
import { MapPin, Users, BadgeCheck, ShieldAlert } from 'lucide-react';
import type { Person } from '../../../types';
import '../Feed.css';

interface FeedCardProps {
  person: Person;
}

export const FeedCard: React.FC<FeedCardProps> = ({ person }) => {

  // Identidad protegida: menores (LOPNNA) o casos marcados como protegidos por el backend.
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
      {/* Header */}
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

      {/* Sellos de confianza */}
      {(verifiedBy || isProtected) && (
        <div className="feed-card-badges">
          {verifiedBy && <span className="badge verified"><BadgeCheck size={13} /> {verifiedBy}</span>}
          {isProtected && <span className="badge protected"><ShieldAlert size={13} /> Protegido</span>}
        </div>
      )}

      {/* Photo */}
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

      {/* Footer */}
      <div className="feed-card-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
          <div>🏢 <strong>Entidad:</strong> {person.data?.origen || 'Protección Civil'}</div>
          <div>📍 <strong>Ubicación:</strong> {person.lastSeen?.description || person.lastSeen?.state || 'Ubicación no precisada'}</div>
        </div>
      </div>
    </article>
  );
};
