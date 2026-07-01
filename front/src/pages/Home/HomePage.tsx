import React from 'react';
import { Search, PlusCircle, Megaphone, ShieldCheck, Building2 } from 'lucide-react';
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
  onSelectPerson: (p: Person) => void;
  onNavigate: (view: any) => void;
}

const COMUNICADOS = [
  { title: 'Actualización importante', time: 'Hace 2 horas', text: 'Se han habilitado nuevos centros de atención y refugios en Caracas.' },
  { title: 'Líneas de emergencia activas', time: 'Hace 5 horas', text: 'Protección Civil habilitó líneas para reportes en las zonas más afectadas.' },
];

export const HomePage: React.FC<HomePageProps> = ({ counts, onBuscar, onReportar, onNavigate }) => {
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
            <strong>{counts.total}</strong>
            <span>Casos reportados</span>
          </div>
          <div>
            <strong>0</strong>
            <span>Medios</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Organizaciones</span>
          </div>
        </div>
      </section>

      <section className="home-primary">
        <Button fullWidth size="lg" variant="danger" onClick={onReportar} className="home-btn-override"><PlusCircle size={18} /> Reportar caso</Button>
        <Button fullWidth size="lg" onClick={onBuscar} className="home-btn-override"><Search size={18} /> Buscar personas</Button>
        <Button fullWidth size="lg" onClick={() => onNavigate('directorio')} className="home-btn-override" style={{ backgroundColor: '#0d9488', color: 'white', border: 'none' }}><Building2 size={18} /> Directorio</Button>
        <Button fullWidth size="lg" onClick={() => onNavigate('manual')} className="home-btn-override" style={{ backgroundColor: '#6366f1', color: 'white', border: 'none' }}><ShieldCheck size={18} /> Manual y políticas</Button>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2 className="home-h2">Últimos comunicados</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('logistics')} className="link-btn-override">Ver todos</Button>
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
    </div>
  );
};
