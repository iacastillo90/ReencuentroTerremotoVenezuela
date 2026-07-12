/**
 * pages/Feed/Feed.tsx — Feed principal de personas y desastres
 *
 * PROPÓSITO:
 *   Lista paginada con scroll infinito de personas reportadas.
 *   Incluye búsqueda por texto y filtros por categoría.
 *
 * COMPONENTES:
 *   - FeedPage: lista principal con chip filters, search, infinite scroll.
 *   - FeedSidebar: panel de estadísticas para desktop (sidebar).
 *
 * FILTROS (chips):
 *   - Desaparecidos: status === 'missing' (default).
 *   - Encontrados: status === 'found'.
 *   - Mascotas: type === 'animal'.
 *   - Todos: sin filtro.
 *   - Desastres: lista de Disaster (no Person).
 *
 * SCROLL INFINITO (IntersectionObserver):
 *   Un div "sentinel" al final de la lista se observa con
 *   IntersectionObserver. Cuando entra en el viewport y
 *   hay más datos (hasMore) y no se está cargando (loadingMore),
 *   se dispara onLoadMore().
 *   La búsqueda activa (searchQuery) desactiva el scroll infinito
 *   porque los resultados de búsqueda no se pagan.
 *
 * BÚSQUEDA:
 *   El input de búsqueda es controlado por el padre (App.tsx)
 *   que pasa searchQuery y onSearchChange. La lógica de debounce
 *   (500ms) está en el padre.
 *
 * ALERTAS DE BÚSQUEDA:
 *   Si el usuario está logueado y la búsqueda no da resultados,
 *   puede crear una "Alerta de Búsqueda" que notificará cuando
 *   aparezca una coincidencia.
 *
 * SIDEBAR (desktop):
 *   FeedSidebar muestra 4 tarjetas de estadísticas:
 *   desaparecidos, encontrados, alertas activas, total en BD.
 *   Se renderiza condicionalmente desde App.tsx.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Search, AlertTriangle, Users, MapPin, Loader2, PawPrint } from 'lucide-react';
import { FeedCard } from './components/FeedCard';
import { EmptyState } from '../../components/common/EmptyState';
import { FeedSkeletonList } from '../../components/common/Skeleton';
import type { Person, Disaster } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { api } from '../../services/api';
import './Feed.css';

interface Counts { missing: number; found: number; total: number; }

interface FeedPageProps {
  persons: Person[];
  disasters: Disaster[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  counts: Counts;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLoadMore: () => void;
}

type Filter = 'all' | 'missing' | 'found' | 'animals' | 'disasters';

export const FeedPage: React.FC<FeedPageProps> = ({
  persons, disasters, loading, loadingMore, hasMore, total, counts, searchQuery, onSearchChange, onLoadMore
}) => {
  const [filter, setFilter] = useState<Filter>('missing');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();
  const [creatingAlert, setCreatingAlert] = useState(false);

  useEffect(() => { setIsSearchPending(false); }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    if (value !== searchQuery) setIsSearchPending(true);
    onSearchChange(value);
  };

  const handleCreateSearchRequest = async () => {
    if (!searchQuery) return;
    try {
      setCreatingAlert(true);
      await api.post('/search-requests', {
        searchName: searchQuery,
        category: 'adulto',
        isMinor: false
      });
      addToast('Alerta de búsqueda creada exitosamente. Te notificaremos si hay coincidencias.', 'success');
    } catch (e: any) {
      addToast(e.response?.data?.error || 'Error al crear alerta de búsqueda', 'error');
    } finally {
      setCreatingAlert(false);
    }
  };

  // IntersectionObserver para scroll infinito
  // Cuando el sentinel entra en el viewport, carga más datos.
  // Solo se activa si hasMore y !loadingMore y !searchQuery.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current && !searchQueryRef.current) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore]);

  // Filtra personas según el chip activo
  const filtered = persons
    .filter(p => {
      if (filter === 'missing') return p.status === 'missing' && p.type !== 'animal';
      if (filter === 'found')   return p.status === 'found' && p.type !== 'animal';
      if (filter === 'animals') return p.type === 'animal';
      return true;
    });

  const chips: { key: Filter; icon: React.ReactNode; label: string; count?: number }[] = [
    { key: 'missing',   icon: <AlertTriangle size={13} />, label: 'Desaparecidos', count: counts.missing },
    { key: 'found',     icon: <Users size={13} />,         label: 'Encontrados',   count: counts.found },
    { key: 'animals',   icon: <PawPrint size={13} />,      label: 'Mascotas',      count: (counts as any).animals || 0 },
    { key: 'all',       icon: <MapPin size={13} />,        label: 'Todos',         count: counts.total },
    { key: 'disasters', icon: <AlertTriangle size={13} />, label: 'Desastres',     count: disasters.length },
  ];

  return (
    <div className="feed-page">
      {/* Barra de búsqueda y filtros */}
      <div className="feed-filter-bar">
        <div className="feed-search-row">
          <Search size={17} color="var(--clr-text-dim)" />
          <input
            type="text"
            placeholder="Buscar por nombre o zona..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label="Buscar personas"
          />
          {isSearchPending && <span className="feed-search-pending">Buscando...</span>}
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

      {/* Lista del feed */}
      {loading ? (
        <div className="feed-list" data-testid="feed-skeleton-loading">
          <FeedSkeletonList count={5} />
        </div>
      ) : filter === 'disasters' ? (
        /* Lista de desastres (no personas) */
        <div className="feed-list">
          {disasters.length === 0 ? (
            <EmptyState icon="alert" message="No hay desastres activos reportados" subtext="Los desastres activos aparecerán aquí automáticamente." />
          ) : disasters.map(d => (
            <article key={d._id} className={`feed-card ${d.severity === 'critical' ? 'feed-card-critical' : 'feed-card-amber'}`}>
              <div className="feed-card-header">
                <div className="feed-avatar feed-avatar-danger">
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
        /* Sin resultados: muestra botón de crear alerta si hay búsqueda */
        <div className="feed-list">
          <EmptyState
            icon="search"
            message={searchQuery ? `Sin resultados para "${searchQuery}"` : "No se encontraron personas con esos filtros"}
            subtext={searchQuery ? "Prueba con otros términos o crea una alerta para recibir notificaciones." : "Intenta cambiar el filtro o crear un reporte."}
            action={searchQuery && user ? {
              label: 'Crear Alerta de Búsqueda',
              onClick: handleCreateSearchRequest,
              disabled: creatingAlert
            } : undefined}
          />
          {searchQuery && !user && (
            <div className="feed-empty" style={{ paddingTop: 0 }}>
              <p className="feed-empty-login-hint">Inicia sesión para crear una alerta de búsqueda automatizada por IA.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="feed-list">
          {filtered.map(p => (
            <FeedCard
              key={p.idHash}
              person={p}
            />
          ))}

          {/* Sentinel para scroll infinito */}
          <div ref={sentinelRef} className="feed-sentinel" />

          {/* Spinner de carga de más datos */}
          {loadingMore && (
            <div className="feed-loading-more">
              <Loader2 size={20} className="spinner" />
              <span>Cargando más registros...</span>
            </div>
          )}

          {/* Indicador de fin del feed */}
          {!hasMore && persons.length > 0 && (
            <div className="feed-end">
              <span>✓ {total.toLocaleString()} registros encontrados</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Sidebar panel para desktop ─── */
export const FeedSidebar: React.FC<{
  persons: Person[];
  disasters: Disaster[];
  total: number;
  counts: Counts;
}> = ({ disasters, total, counts }) => (
  <div className="sidebar-panel">
    <div className="sidebar-stats">
      <div className="sidebar-stat danger">
        <AlertTriangle size={20} />
        <div>
          <h4>{counts.missing.toLocaleString()}</h4>
          <p>Desaparecidos</p>
        </div>
      </div>
      <div className="sidebar-stat success">
        <Users size={20} />
        <div>
          <h4>{counts.found.toLocaleString()}</h4>
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
      <div className="sidebar-stat sidebar-stat-amber">
        <span className="sidebar-stat-icon-large">🗄️</span>
        <div>
          <h4>{total.toLocaleString()}</h4>
          <p>Total en BD</p>
        </div>
      </div>
    </div>

    <p className="sidebar-panel-footer">
      Plataforma de búsqueda y reencuentro de personas afectadas por el terremoto en Venezuela.
      Todos los reportes son públicos para maximizar la visibilidad.
    </p>
  </div>
);
