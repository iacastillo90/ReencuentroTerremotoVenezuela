import React from 'react';
import { Search, PlusCircle, Map as MapIcon, Megaphone, ChevronRight, ShieldCheck } from 'lucide-react';
import type { Person } from '../../types';
import { Button } from '../../components/ui/Button';
import reunionHero from '../../assets/home-reunion-venezuela.png';
import './Home.css';

interface Counts { missing: number; found: number; total: number; }

interface HomePageProps {
  counts: Counts;
  persons: Person[];
  onBuscar: () => void;
  onReportar: () => void;
  onMapa: () => void;
  onSelectPerson: (p: Person) => void;
}

const COMUNICADOS = [
  { title: 'Actualización importante', time: 'Hace 2 horas', text: 'Se han habilitado nuevos centros de atención y refugios en Caracas.' },
  { title: 'Líneas de emergencia activas', time: 'Hace 5 horas', text: 'Protección Civil habilitó líneas para reportes en las zonas más afectadas.' },
];

const ORGS = [
  { name: 'Cruz Roja', color: '#E4002B' },
  { name: 'Protección', color: '#F59E0B' },
  { name: 'Cáritas', color: '#C0392B' },
  { name: 'Unicef', color: '#1CABE2' },
];

const isMinor = (p: Person) => p.age != null && p.age > 0 && p.age < 18;

function statusLabel(status?: string): { label: string; cls: string } {
  switch (status) {
    case 'found': return { label: 'Reencontrado', cls: 'ok' };
    case 'deceased': return { label: 'Fallecido', cls: 'neutral' };
    case 'missing': return { label: 'En búsqueda', cls: 'warn' };
    default: return { label: 'Sin verificar', cls: 'neutral' };
  }
}

export const HomePage: React.FC<HomePageProps> = ({ counts, persons, onBuscar, onReportar, onMapa, onSelectPerson }) => {
  const recent = (persons || []).filter(p => p && p.name).slice(0, 3);

  return (
    <div className="home">
      <section className="home-hero" style={{ backgroundImage: `url(${reunionHero})` }}>
        <div className="home-hero__copy">
          <span className="home-kicker">Red humanitaria activa</span>
          <h1 className="home-title">Juntos<br />te encontramos</h1>
          <p className="home-lead">Plataforma inteligente para la búsqueda y reencuentro de personas.</p>
        </div>

        <div className="home-stats" aria-label="Resumen de registros">
          <div>
            <strong>{counts.missing}</strong>
            <span>En búsqueda</span>
          </div>
          <div>
            <strong>{counts.found}</strong>
            <span>Localizados</span>
          </div>
          <div>
            <strong>{counts.total}</strong>
            <span>Registros</span>
          </div>
        </div>
      </section>

      <section className="home-primary">
        <Button fullWidth size="lg" onClick={onBuscar} className="home-btn-override"><Search size={18} /> Buscar personas</Button>
        <Button fullWidth size="lg" variant="danger" onClick={onReportar} className="home-btn-override"><PlusCircle size={18} /> Reportar caso</Button>
        <Button fullWidth size="lg" variant="outline" onClick={onMapa} className="home-btn-override"><MapIcon size={18} /> Mapa de calor</Button>
      </section>

      <section className="home-section home-section--howto">
        <div className="howto-card" onClick={onBuscar} role="button" tabIndex={0}>
          <div className="howto-card__body">
            <strong>¿Cómo funciona?</strong>
            <span>Conoce cómo funciona la plataforma y cómo puedes ayudar.</span>
          </div>
          <ChevronRight size={20} className="howto-card__chev" />
        </div>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-h2">Últimos comunicados</h2>
          <Button variant="ghost" size="sm" onClick={onBuscar} className="link-btn-override">Ver todos</Button>
        </div>
        <div className="home-comunicados">
          {COMUNICADOS.map((c, i) => (
            <div className="comunicado" key={i}>
              <div className="comunicado__icon"><Megaphone size={20} /></div>
              <div className="comunicado__body">
                <div className="comunicado__head">
                  <span className="comunicado__title">{c.title}</span>
                  <span className="comunicado__time">{c.time}</span>
                </div>
                <p className="comunicado__text">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-h2">Organizaciones aliadas</h2>
          <Button variant="ghost" size="sm" className="link-btn-override">Ver todas</Button>
        </div>
        <div className="home-orgs">
          {ORGS.map((o, i) => (
            <div className="org-card" key={i}>
              <div className="org-card__logo" style={{ background: o.color }}>{o.name.charAt(0)}</div>
              <span className="org-card__name">{o.name}</span>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="home-section">
          <div className="home-section__head">
            <h2 className="home-h2">Casos recientes</h2>
            <Button variant="ghost" size="sm" onClick={onBuscar} className="link-btn-override">Ver todos</Button>
          </div>
          <div className="home-cases">
            {recent.map((p, i) => {
              if (isMinor(p)) {
                return (
                  <div className="case-row protected" key={p.idHash || i} title="Caso protegido de un menor">
                    <div className="case-row__avatar shield"><ShieldCheck size={20} /></div>
                    <div className="case-row__info">
                      <strong>Caso protegido</strong>
                      <span>Menor — gestionado por una organización autorizada</span>
                    </div>
                    <span className="case-chip neutral">Protegido</span>
                  </div>
                );
              }
              const st = statusLabel(p.status);
              return (
                <div className="case-row" key={p.idHash || i} onClick={() => onSelectPerson(p)} role="button" tabIndex={0}>
                  <div className="case-row__avatar">
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt={p.name} loading="lazy" />
                      : <span>{(p.name || '?').charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="case-row__info">
                    <strong>{p.name}</strong>
                    <span>{p.lastSeen?.state || 'Ubicación no especificada'}</span>
                  </div>
                  <span className={`case-chip ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
