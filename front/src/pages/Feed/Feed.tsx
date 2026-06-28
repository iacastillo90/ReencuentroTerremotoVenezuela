import React, { useState, useRef, useEffect } from 'react';
import { Search, AlertTriangle, Users, MapPin, Loader2 } from 'lucide-react';
import { FeedCard } from './components/FeedCard';
import type { Person, Disaster } from '../../types';
import './Feed.css';

interface FeedPageProps {
  persons: Person[];
  disasters: Disaster[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  onSelectPerson: (p: Person) => void;
  onLoadMore: () => void;
}

type Filter = 'all' | 'missing' | 'found' | 'disasters';

export const FeedPage: React.FC<FeedPageProps> = ({
  persons, disasters, loading, loadingMore, hasMore, total, onSelectPerson, onLoadMore
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('missing');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — dispara loadMore al llegar al final
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !search) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, search]);

  const filtered = persons
    .filter(p => {
      if (filter === 'missing') return p.status === 'missing';
      if (filter === 'found')   return p.status === 'found';
      return true;
    })
    .filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.lastSeen?.state || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
    );

  const chips: { key: Filter; icon: React.ReactNode; label: string; count?: number }[] = [
    { key: 'missing',   icon: <AlertTriangle size={13} />, label: 'Desaparecidos', count: persons.filter(p => p.status === 'missing').length },
    { key: 'found',     icon: <Users size={13} />,         label: 'Encontrados',   count: persons.filter(p => p.status === 'found').length },
    { key: 'all',       icon: <MapPin size={13} />,        label: 'Todos',         count: total },
    { key: 'disasters', icon: <AlertTriangle size={13} />, label: 'Desastres',     count: disasters.length },
  ];

  return (
    <div className="feed-page">
      {/* Filter bar */}
      <div className="feed-filter-bar">
        <div className="feed-search-row">
          <Search size={17} color="var(--clr-text-dim)" />
          <input
            type="text"
            placeholder="Buscar por nombre, zona o descripción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="feed-chips">
          {chips.map(c => (
            <button
              key={c.key}
              className={`chip ${filter === c.key ? 'active' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.icon} {c.label}
              {c.count !== undefined && (
                <span className="chip-count">{c.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      {loading ? (
        <div className="feed-loading">
          <Loader2 size={28} className="spinner" />
          <span>Cargando registros...</span>
        </div>
      ) : filter === 'disasters' ? (
        <div className="feed-list">
          {disasters.length === 0 ? (
            <div className="feed-empty">
              <AlertTriangle size={40} />
              <p>No hay desastres activos reportados.</p>
            </div>
          ) : disasters.map(d => (
            <article key={d._id} className="feed-card" style={{ borderLeft: `3px solid ${d.severity === 'critical' ? 'var(--clr-danger)' : 'var(--clr-amber)'}` }}>
              <div className="feed-card-header">
                <div className="feed-avatar" style={{ color: 'var(--clr-danger)' }}>
                  <AlertTriangle size={22} />
                </div>
                <div className="feed-card-meta">
                  <div className="feed-card-name">{d.title}</div>
                  <div className="feed-card-sub">
                    <MapPin size={11} /> {d.type} · Severidad: {d.severity}
                  </div>
                </div>
                <span className="badge missing">{d.severity}</span>
              </div>
            </article>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="feed-empty">
          <Users size={48} />
          <p>No se encontraron personas con esos filtros.</p>
          {search && <small>Intenta con otro nombre o zona.</small>}
        </div>
      ) : (
        <div className="feed-list">
          {filtered.map(p => (
            <FeedCard
              key={p.idHash}
              person={p}
              onClick={() => onSelectPerson(p)}
            />
          ))}

          {/* Sentinel para scroll infinito */}
          <div ref={sentinelRef} style={{ height: '1px' }} />

          {/* Spinner de carga más */}
          {loadingMore && (
            <div className="feed-loading-more">
              <Loader2 size={20} className="spinner" />
              <span>Cargando más registros...</span>
            </div>
          )}

          {/* Fin del feed */}
          {!hasMore && persons.length > 0 && !search && (
            <div className="feed-end">
              <span>✓ {total.toLocaleString()} registros cargados</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Sidebar panel (desktop) ─── */
export const FeedSidebar: React.FC<{
  persons: Person[];
  disasters: Disaster[];
  total: number;
}> = ({ persons, disasters, total }) => (
  <div className="sidebar-panel">
    <div className="sidebar-stats">
      <div className="sidebar-stat danger">
        <AlertTriangle size={20} />
        <div>
          <h4>{persons.filter(p => p.status === 'missing').length.toLocaleString()}</h4>
          <p>Desaparecidos</p>
        </div>
      </div>
      <div className="sidebar-stat success">
        <Users size={20} />
        <div>
          <h4>{persons.filter(p => p.status === 'found').length.toLocaleString()}</h4>
          <p>Encontrados</p>
        </div>
      </div>
      <div className="sidebar-stat primary">
        <MapPin size={20} />
        <div>
          <h4>{disasters.length}</h4>
          <p>Alertas Activas</p>
        </div>
      </div>
      <div className="sidebar-stat" style={{ color: 'var(--clr-amber)' }}>
        <span style={{ fontSize: '1.1rem' }}>🗄️</span>
        <div>
          <h4>{total.toLocaleString()}</h4>
          <p>Total en BD</p>
        </div>
      </div>
    </div>

    <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
      Plataforma de búsqueda y reencuentro de personas afectadas por el terremoto en Venezuela.
      Todos los reportes son públicos para maximizar la visibilidad.
    </p>
  </div>
);
