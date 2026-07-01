import React from 'react';
import { MapPin, Users, BadgeCheck, ShieldAlert } from 'lucide-react';
import type { Person } from '../../../types';
import '../Feed.css';

interface FeedCardProps {
  person: Person;
  onClick: () => void;
}

export const FeedCard: React.FC<FeedCardProps> = ({ person, onClick }) => {
  const urgency = person.metadata?.urgencyScore ?? 0;
  const urgencyClass = urgency >= 75 ? 'high' : urgency >= 40 ? 'medium' : 'low';

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
    <article className="feed-card" onClick={onClick} role="button" tabIndex={0}>
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
          <div className="feed-card-sub">
            <MapPin size={11} />
            {person.lastSeen?.state || 'Ubicación desconocida'}
            {timeAgo() && <>&nbsp;·&nbsp;{timeAgo()}</>}
          </div>
        </div>
        <span className={`badge ${person.status}`}>
          {person.status === 'missing' ? 'Buscado' : 'Encontrado'}
        </span>
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
        <div className="feed-card-footer-top">
          <div className="feed-card-location">
            <MapPin size={12} /> {person.lastSeen?.state || '—'}
            {person.age && <>&nbsp;·&nbsp;{person.age}&nbsp;años</>}
            {(person as any)['data.cedula'] || (person as any).data?.cedula
              ? <>&nbsp;·&nbsp;CI: {(person as any).data.cedula}</>
              : null}
          </div>
          <small style={{ color: 'var(--clr-text-dim)', fontSize: '0.72rem' }}>
            Urgencia {urgency}/100
          </small>
        </div>
        <div className="urgency-bar">
          <div
            className={`urgency-fill ${urgencyClass}`}
            style={{ width: `${urgency}%` }}
          />
        </div>
        {person.description && (
          <p className="feed-card-desc">{person.description}</p>
        )}
      </div>
    </article>
  );
};
