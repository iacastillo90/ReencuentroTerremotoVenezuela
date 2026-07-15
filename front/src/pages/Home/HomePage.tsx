import React from 'react';
import { Search, Plus, ShieldAlert } from 'lucide-react';
import type { Person, View } from '../../types';
import { HomeStats } from '../../components/HomeStats';
import { HomeActionCard } from '../../components/HomeActionCard';
import reunionHero from '../../assets/home-reunion-venezuela.png';
import './Home.css';

interface Counts { missing: number; found: number; total: number; }

interface HomePageProps {
  counts: Counts;
  persons: Person[];
  onBuscar: () => void;
  onReportar: () => void;
  onSelectPerson: (p: Person) => void;
  onNavigate: (view: View) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ counts, onBuscar, onReportar, onNavigate }) => {
  return (
    <div className="home home--logged" style={{ backgroundImage: `url(${reunionHero})` }}>
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="home-kicker">Red humanitaria activa</span>
          <h1 className="home-title">Juntos<br />te encontramos</h1>
          <p className="home-lead">Plataforma inteligente para la búsqueda y reencuentro de personas.</p>
        </div>
        <div className="home-stats-wrapper">
          <HomeStats counts={counts} />
        </div>
      </section>
      <section className="home-primary">
        <HomeActionCard
          icon={<Plus size={18} strokeWidth={2} />}
          title="Reportar caso"
          onClick={onReportar}
          className="home__btn home__btn--primary"
        />
        <HomeActionCard
          icon={<Search size={18} strokeWidth={2} />}
          title="Buscar personas o mascotas"
          onClick={onBuscar}
          className="home__btn home__btn--outline"
        />
        <button className="home__manual-btn" onClick={() => onNavigate('manual')}>
          <ShieldAlert size={20} /> Manual y políticas
        </button>
      </section>
    </div>
  );
};
