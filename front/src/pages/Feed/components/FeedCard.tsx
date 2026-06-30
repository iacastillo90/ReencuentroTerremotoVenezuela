import React from 'react';
import { MapPin, Users, ShieldCheck } from 'lucide-react';
import type { Person } from '../../../types';
import { isProtectedMinor } from '../../../utils/personPolicy';
import '../Feed.css';

interface FeedCardProps {
  person: Person;
  onClick: () => void;
}

export const FeedCard: React.FC<FeedCardProps> = ({ person, onClick }) => {
  const urgency = person.metadata?.urgencyScore ?? 0;
  const urgencyClass = urgency >= 75 ? 'high' : urgency >= 40 ? 'medium' : 'low';

  const timeAgo = () => {
    if (!person.metadata?.createdAt) return null;
    const diff = (Date.now() - new Date(person.metadata.createdAt).getTime()) / 1000;
    if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
    return `hace ${Math.round(diff / 86400)} d`;
  };

  // Menor de edad → tarjeta enmascarada (LOPNNA), sin datos identificables
  if (isProtectedMinor(person)) {
    return (
      <article className="feed-card" onClick={onClick} role="button" tabIndex={0}>
        <div className="feed-card-header">
          <div className="feed-avatar"><ShieldCheck size={22} /></div>
          <div className="feed-card-meta">
            <div className="feed-card-name">Caso protegido</div>
            <div className="feed-card-sub">
              <MapPin size={11} /> {person.lastSeen?.state || 'Zona reservada'}
            </div>
          </div>
          <span className={`badge ${person.status}`}>
            {person.status === 'missing' ? 'Buscado' : 'Encontrado'}
          </span>
        </div>
        <div className="feed-card-footer">
          <p className="feed-card-desc">Menor de edad — gestionado por una organización autorizada (LOPNNA).</p>
        </div>
      </article>
    );
  }

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

      {/* Photo */}
      <div className="feed-card-photo">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name} loading="lazy" />
        ) : (
          <div className="feed-card-photo-placeholder">
            <Users size={36} />
            <span>Sin fotografía</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="feed-card-footer">
        <div className="feed-card-footer-top">
          <div className="feed-card-location">
            <MapPin size={12} /> {person.lastSeen?.state || '—'}
            {person.age && <>&nbsp;·&nbsp;{person.age}&nbsp;años</>}
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
