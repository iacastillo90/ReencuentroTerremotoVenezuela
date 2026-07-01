import React from 'react';
import { Search, PlusCircle, Building2, ShieldCheck, Lock, ArrowRight, Unlock } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import reunionHero from '../../assets/home-reunion-venezuela.png';
import './PublicLanding.css';
import './HomeGateway.css';

interface HomeGatewayProps {
  counts?: { missing: number; found: number; total: number };
  onBuscar: () => void;      // requiere login (gating en App)
  onReportar: () => void;    // requiere login (gating en App)
  onDirectorio: () => void;  // público
  onManual: () => void;      // público
}

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  tone: 'red' | 'blue' | 'green';
  locked: boolean;
  onClick: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({ icon, title, desc, cta, tone, locked, onClick }) => (
  <button className={`hg-card tone-${tone}`} onClick={onClick}>
    <span className="hg-card__ico">{icon}</span>
    <span className="hg-card__body">
      <span className="hg-card__head">
        <strong>{title}</strong>
        <span className={`hg-badge ${locked ? 'locked' : 'open'}`}>
          {locked ? <><Lock size={11} /> Requiere sesión</> : <><Unlock size={11} /> Acceso libre</>}
        </span>
      </span>
      <span className="hg-card__desc">{desc}</span>
      <span className="hg-card__cta">{cta} <ArrowRight size={15} /></span>
    </span>
  </button>
);

/** Home público: presenta las opciones sobre un fondo de marca. Reportar/Buscar piden login; Directorio/Manual son públicos. */
export const HomeGateway: React.FC<HomeGatewayProps> = ({ counts, onBuscar, onReportar, onDirectorio, onManual }) => (
  <div className="public-landing hg">
    <div className="pl__bg" />
    <div className="hg__inner">
      <div className="hg__hero" style={{ backgroundImage: `url(${reunionHero})` }}>
        <div className="hg__hero-copy">
          <div className="hg__brand">
          <BrandMark size={40} />
          <div className="hg__brand-text">
            <span className="hg__brand-name">Reencuentros <em>Venezuela</em></span>
            <small>JUNTOS TE ENCONTRAMOS</small>
          </div>
        </div>
        <p className="eyebrow">Tecnología humanitaria</p>
        <h1 className="hg__title">Juntos <span>te encontramos</span></h1>
        <p className="hg__sub">Conectamos familias, comunidades y organizaciones para reencontrar personas desaparecidas durante emergencias y desastres.</p>

        {counts && counts.total > 0 && (
          <div className="hg__stats">
            <div><strong>{counts.missing}</strong><span>En búsqueda</span></div>
            <div><strong>{counts.found}</strong><span>Localizados</span></div>
            <div><strong>{counts.total}</strong><span>Registros</span></div>
          </div>
        )}
        </div>

      </div>

      <div className="hg__cards">
        <OptionCard
          icon={<Search size={22} />} tone="blue" locked
          title="Buscar persona" cta="Iniciar sesión"
          desc="Consulta reportes y posibles coincidencias."
          onClick={onBuscar}
        />
        <OptionCard
          icon={<PlusCircle size={22} />} tone="red" locked
          title="Reportar caso" cta="Iniciar sesión"
          desc="Informa sobre una persona o mascota."
          onClick={onReportar}
        />
        <OptionCard
          icon={<Building2 size={22} />} tone="blue" locked={false}
          title="Directorio" cta="Ver contactos"
          desc="Organizaciones y teléfonos de apoyo."
          onClick={onDirectorio}
        />
        <OptionCard
          icon={<ShieldCheck size={22} />} tone="green" locked={false}
          title="Manual" cta="Leer guía"
          desc="Qué hacer antes, durante y después."
          onClick={onManual}
        />
      </div>
    </div>
  </div>
);
