import React from 'react';
import { Search, HeartHandshake, Heart } from 'lucide-react';
import './PublicLanding.css';

interface PublicLandingProps {
  onBuscar: () => void;
  onAyuda: () => void;
}

/** Landing público (mockup "home public"). Bienvenida para usuarios no autenticados. Responsive. */
export const PublicLanding: React.FC<PublicLandingProps> = ({ onBuscar, onAyuda }) => (
  <div className="public-landing">
    <div className="pl__bg" />
    <div className="pl__inner">
      <div className="pl__brand">
        <span className="pl__heart"><Heart size={26} fill="currentColor" /></span>
        <div className="pl__brand-text">
          <span className="pl__brand-name">Reencuentros <em>Venezuela</em></span>
          <small>JUNTOS TE ENCONTRAMOS</small>
        </div>
      </div>

      <div className="pl__hero">
        <h1 className="pl__title">
          Cada historia importa.<br />
          Cada <span className="accent">reencuentro transforma.</span>
        </h1>
        <p className="pl__sub">La comunidad que ayuda a reunir corazones.</p>

        <div className="pl__actions">
          <button className="pl-btn primary" onClick={onBuscar}><Search size={18} /> Buscar persona</button>
          <button className="pl-btn ghost" onClick={onAyuda}><HeartHandshake size={18} /> Necesito ayuda</button>
        </div>

        <div className="pl__dots" aria-hidden="true">
          <span className="active" /><span /><span /><span />
        </div>
      </div>
    </div>
  </div>
);
