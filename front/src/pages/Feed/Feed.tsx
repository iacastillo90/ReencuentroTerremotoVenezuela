import React, { useState, useRef, useEffect } from 'react';
import { Search, AlertTriangle, Users, MapPin, Loader2, User, UserRound, Baby, ShieldCheck, ClipboardList, Mail, ArrowLeft } from 'lucide-react';
import { FeedCard } from './components/FeedCard';
import type { Person, Disaster } from '../../types';
import { useAuth } from '../../store/AuthContext';
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
  onSelectPerson: (p: Person) => void;
  onLoadMore: () => void;
}

type Filter = 'all' | 'missing' | 'found' | 'disasters';
type AgeCat = 'adulto' | 'adulto_mayor' | 'adolescente' | 'menor';

// Mapea las 4 opciones visuales a lo que entiende el backend (category + isMinor).
const CAT_TO_BACKEND: Record<AgeCat, { category: string; isMinor: boolean }> = {
  adulto:       { category: 'adulto',       isMinor: false },
  adulto_mayor: { category: 'adulto_mayor', isMinor: false },
  adolescente:  { category: 'menor',        isMinor: true  }, // adolescente = menor (LOPNNA)
  menor:        { category: 'menor',        isMinor: true  },
};

const AGE_CATS: { key: AgeCat; icon: React.ReactNode; label: string }[] = [
  { key: 'adulto',       icon: <User size={18} />,       label: 'Adulto' },
  { key: 'adulto_mayor', icon: <UserRound size={18} />,  label: 'Adulto mayor' },
  { key: 'adolescente',  icon: <User size={18} />,       label: 'Adolescente' },
  { key: 'menor',        icon: <Baby size={18} />,       label: 'Niño/a' },
];

const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

const RANGOS = [
  { v: '', label: 'Cualquiera' },
  { v: '18-29', label: '18 a 29' },
  { v: '30-44', label: '30 a 44' },
  { v: '45-59', label: '45 a 59' },
  { v: '60-200', label: '60 o más' },
];

export const FeedPage: React.FC<FeedPageProps> = ({
  persons, disasters, loading, loadingMore, hasMore, total, counts, searchQuery, onSearchChange, onSelectPerson, onLoadMore
}) => {
  const [filter, setFilter] = useState<Filter>('missing');
  const [ageCategory, setAgeCategory] = useState<AgeCat>('adulto');
  const [submitted, setSubmitted] = useState(false);
  const [fEstado, setFEstado] = useState('');
  const [fMunicipio, setFMunicipio] = useState('');
  const [fRango, setFRango] = useState('');
  const [fFecha, setFFecha] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [creatingAlert, setCreatingAlert] = useState(false);

  // Por protección (LOPNNA) los menores no se listan: se gestiona por solicitud.
  const isMinorCat = ageCategory === 'menor' || ageCategory === 'adolescente';

  const handleCreateSearchRequest = async () => {
    if (!searchQuery.trim()) {
      alert('Escribe el nombre de la persona que buscas.');
      return;
    }
    try {
      setCreatingAlert(true);
      const { category, isMinor } = CAT_TO_BACKEND[ageCategory];
      await api.post('/search-requests', { searchName: searchQuery, category, isMinor });
      alert(
        isMinor
          ? 'Solicitud enviada. Por protección de menores, nuestro equipo revisará la información y te contactará por correo si existe un caso relacionado.'
          : 'Alerta de búsqueda creada exitosamente. Te notificaremos si hay coincidencias.'
      );
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al crear la solicitud de búsqueda');
    } finally {
      setCreatingAlert(false);
    }
  };

  // IntersectionObserver — dispara loadMore al llegar al final
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !searchQuery) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const inRango = (age?: number) => {
    if (!fRango || age == null) return true;
    const [min, max] = fRango.split('-').map(Number);
    return age >= min && age <= max;
  };

  const filtered = persons.filter(p => {
    if (filter === 'missing' && p.status !== 'missing') return false;
    if (filter === 'found' && p.status !== 'found') return false;
    if (ageCategory === 'adulto_mayor' && !(p.age != null && p.age >= 60)) return false;
    if (fEstado && p.lastSeen?.state !== fEstado) return false;
    if (fMunicipio && !(p.lastSeen?.municipality || '').toLowerCase().includes(fMunicipio.toLowerCase())) return false;
    if (!inRango(p.age)) return false;
    return true;
  });

  const chips: { key: Filter; icon: React.ReactNode; label: string; count?: number }[] = [
    { key: 'missing',   icon: <AlertTriangle size={13} />, label: 'Desaparecidos', count: counts.missing },
    { key: 'found',     icon: <Users size={13} />,         label: 'Encontrados',   count: counts.found },
    { key: 'all',       icon: <MapPin size={13} />,        label: 'Todos',         count: counts.total },
    { key: 'disasters', icon: <AlertTriangle size={13} />, label: 'Desastres',     count: disasters.length },
  ];

  // ─── Selector de categoría de edad (compartido) ───
  const ageSelector = (
    <div className="feed-agecats">
      <span className="feed-agecats__label">¿A quién buscas?</span>
      <div className="agecat-row">
        {AGE_CATS.map(c => {
          const minor = c.key === 'menor' || c.key === 'adolescente';
          return (
            <button
              key={c.key}
              className={`agecat ${minor ? 'minor' : ''} ${ageCategory === c.key ? 'active' : ''}`}
              onClick={() => setAgeCategory(c.key)}
            >
              {c.icon} {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Aviso de protección de menores (mockup #5) ───
  const minorNotice = (
    <div className="minor-notice">
      <div className="minor-notice__shield"><ShieldCheck size={40} /></div>
      <h2>Búsqueda de niños y adolescentes</h2>
      <div className="minor-notice__alert">
        Por protección legal y ética (LOPNNA), la información de niños, niñas y adolescentes no se muestra
        directamente en los resultados de búsqueda.
      </div>
      <p className="minor-notice__lead">
        Si estás buscando a un menor de edad, podemos ayudarte a verificar si existe un reporte relacionado.
      </p>
      <h4>¿Cómo funciona?</h4>
      <div className="minor-steps">
        <div className="minor-step"><div className="minor-step__icon"><ClipboardList size={16} /></div><span>1. Completa el formulario de solicitud con el nombre del menor.</span></div>
        <div className="minor-step"><div className="minor-step__icon"><ShieldCheck size={16} /></div><span>2. Nuestro equipo revisará la información de forma protegida.</span></div>
        <div className="minor-step"><div className="minor-step__icon"><Mail size={16} /></div><span>3. Si existe un posible caso, te contactaremos por correo electrónico.</span></div>
      </div>
      <input
        className="minor-notice__input"
        placeholder="Nombre del niño, niña o adolescente"
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
      />
      {user ? (
        <button className="minor-notice__btn" onClick={handleCreateSearchRequest} disabled={creatingAlert}>
          {creatingAlert ? 'Enviando…' : 'Solicitar búsqueda'}
        </button>
      ) : (
        <p style={{ fontSize: '0.82rem', color: 'var(--clr-amber)', marginTop: '0.5rem' }}>
          Inicia sesión para enviar una solicitud de búsqueda protegida.
        </p>
      )}
      <a className="minor-notice__link" href="#" onClick={e => e.preventDefault()}>
        Conoce más sobre nuestra política de protección infantil
      </a>
    </div>
  );

  // ─── Formulario de búsqueda (mockup #4) ───
  const searchForm = (
    <div className="search-form">
      <h2 className="search-form__title">Buscar personas</h2>
      <div className="feed-contact-note">
        <ShieldCheck size={16} />
        Para ver información detallada es necesario realizar una solicitud de contacto. Esto nos ayuda a
        proteger la privacidad de las personas y evitar el mal uso de los datos.
      </div>
      {ageSelector}
      <div className="search-filters">
        <span className="search-form__label">Filtros de búsqueda (opcionales)</span>
        <div className="search-field">
          <label>Estado / Provincia</label>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="">Selecciona</option>
            {ESTADOS_VE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="search-field">
          <label>Municipio</label>
          <input placeholder="Escribe el municipio" value={fMunicipio} onChange={e => setFMunicipio(e.target.value)} />
        </div>
        <div className="search-grid2">
          <div className="search-field">
            <label>Rango de edad</label>
            <select value={fRango} onChange={e => setFRango(e.target.value)}>
              {RANGOS.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </div>
          <div className="search-field">
            <label>Fecha aproximada</label>
            <input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)} />
          </div>
        </div>
      </div>
      <button className="search-form__btn" onClick={() => setSubmitted(true)}>
        <Search size={18} /> Buscar
      </button>
    </div>
  );

  // ─── Resultados (tras pulsar Buscar) ───
  const results = (
    <>
      <div className="feed-filter-bar">
        <button className="modify-search-btn" onClick={() => setSubmitted(false)}>
          <ArrowLeft size={15} /> Modificar búsqueda
        </button>
        <div className="feed-search-row">
          <Search size={17} color="var(--clr-text-dim)" />
          <input type="text" placeholder="Buscar por nombre o zona..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <div className="feed-chips">
          {chips.map(c => (
            <button key={c.key} className={`chip ${filter === c.key ? 'active' : ''}`} onClick={() => setFilter(c.key)}>
              {c.icon} {c.label}
              {c.count !== undefined && <span className="chip-count">{c.count.toLocaleString()}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="feed-loading"><Loader2 size={28} className="spinner" /><span>Cargando registros...</span></div>
      ) : filter === 'disasters' ? (
        <div className="feed-list">
          {disasters.length === 0 ? (
            <div className="feed-empty"><AlertTriangle size={40} /><p>No hay desastres activos reportados.</p></div>
          ) : disasters.map(d => (
            <article key={d._id} className="feed-card" style={{ borderLeft: `3px solid ${d.severity === 'critical' ? 'var(--clr-danger)' : 'var(--clr-amber)'}` }}>
              <div className="feed-card-header">
                <div className="feed-avatar" style={{ color: 'var(--clr-danger)' }}><AlertTriangle size={22} /></div>
                <div className="feed-card-meta">
                  <div className="feed-card-name">{d.title}</div>
                  <div className="feed-card-sub"><MapPin size={11} /> {d.type} · Severidad: {d.severity}</div>
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
          {searchQuery && (
            <div style={{ marginTop: '15px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--clr-text-muted)', marginBottom: '10px' }}>¿No encuentras a quien buscas?</p>
              {user ? (
                <button onClick={handleCreateSearchRequest} disabled={creatingAlert} className="search-form__btn" style={{ maxWidth: 280, margin: '0 auto' }}>
                  {creatingAlert ? 'Creando...' : 'Crear alerta de búsqueda'}
                </button>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--clr-amber)' }}>Inicia sesión para crear una alerta de búsqueda.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="feed-list">
          {filtered.map(p => (
            <FeedCard key={p.idHash} person={p} onClick={() => onSelectPerson(p)} />
          ))}
          <div ref={sentinelRef} style={{ height: '1px' }} />
          {loadingMore && <div className="feed-loading-more"><Loader2 size={20} className="spinner" /><span>Cargando más registros...</span></div>}
          {!hasMore && persons.length > 0 && <div className="feed-end"><span>✓ {total.toLocaleString()} registros encontrados</span></div>}
        </div>
      )}
    </>
  );

  return (
    <div className="feed-page">
      {isMinorCat ? minorNotice : !submitted ? searchForm : results}
    </div>
  );
};

/* ─── Sidebar panel (desktop) ─── */
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
        <div><h4>{counts.missing.toLocaleString()}</h4><p>Desaparecidos</p></div>
      </div>
      <div className="sidebar-stat success">
        <Users size={20} />
        <div><h4>{counts.found.toLocaleString()}</h4><p>Encontrados</p></div>
      </div>
      <div className="sidebar-stat primary">
        <MapPin size={20} />
        <div><h4>{disasters.length}</h4><p>Alertas Activas</p></div>
      </div>
      <div className="sidebar-stat" style={{ color: 'var(--clr-amber)' }}>
        <span style={{ fontSize: '1.1rem' }}>🗄️</span>
        <div><h4>{total.toLocaleString()}</h4><p>Total en BD</p></div>
      </div>
    </div>
    <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
      Plataforma de búsqueda y reencuentro de personas afectadas por el terremoto en Venezuela.
    </p>
  </div>
);
