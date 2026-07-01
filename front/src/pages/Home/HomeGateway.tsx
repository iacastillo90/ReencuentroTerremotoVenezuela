import React from 'react';
import { Search, PlusCircle, Building2, ShieldCheck, Lock, ArrowRight, Unlock } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
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
      <div className="hg__hero">
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

      <div className="hg__cards">
        <OptionCard
          icon={<Search size={22} />} tone="blue" locked
          title="Buscar" cta="Iniciar sesión"
          desc="Consulta reportes de personas y animales. Requiere iniciar sesión como organización autorizada."
          onClick={onBuscar}
        />
        <OptionCard
          icon={<PlusCircle size={22} />} tone="red" locked
          title="Reportar" cta="Iniciar sesión"
          desc="Sube fotos o videos georreferenciados desde el terreno. Solo organizaciones y medios autorizados."
          onClick={onReportar}
        />
        <OptionCard
          icon={<Building2 size={22} />} tone="blue" locked={false}
          title="Directorio de apoyo" cta="Ingresar"
          desc="Organizaciones verificadas, teléfonos de emergencia y puntos de control. Acceso libre."
          onClick={onDirectorio}
        />
        <OptionCard
          icon={<ShieldCheck size={22} />} tone="green" locked={false}
          title="Manual y políticas" cta="Ingresar"
          desc="Protocolos de actuación sísmica (antes, durante y después) y normas de seguridad humanitaria. Acceso libre."
          onClick={onManual}
        />
      </div>
    </div>
  </div>
);
