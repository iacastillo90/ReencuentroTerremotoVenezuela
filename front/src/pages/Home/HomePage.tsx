import React from 'react';
import { Search, Plus, ShieldAlert } from 'lucide-react';
import type { Person } from '../../types';
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
  onNavigate: (view: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ counts, onBuscar, onReportar, onNavigate }) => {
  return (
    <div className="home" style={{ backgroundImage: `url(${reunionHero})` }}>
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="home-kicker">Red humanitaria activa</span>
          <h1 className="home-title">Juntos<br />te encontramos</h1>
          <p className="home-lead">Plataforma inteligente para la búsqueda y reencuentro de personas.</p>
        </div>

        <div className="home-stats-wrapper" style={{ marginTop: '2rem' }}>
          <HomeStats counts={counts} />
        </div>
      </section>

      <section className="home-primary" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', margin: '2rem 0' }}>
        <HomeActionCard 
          icon={<Plus size={18} strokeWidth={2} />}
          title="Reportar caso"
          onClick={onReportar}
          style={{ backgroundColor: '#3b82f6', border: '1px solid #3b82f6', color: '#111' }}
        />
        <HomeActionCard 
          icon={<Search size={18} strokeWidth={2} />}
          title="Buscar personas o mascotas"
          onClick={onBuscar}
          style={{ backgroundColor: 'transparent', border: '1px solid #3b82f6', color: '#fff' }}
        />
        
        <button 
          onClick={() => onNavigate('manual')}
          style={{
            marginTop: '1.5rem',
            color: '#3b82f6',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            textDecoration: 'none'
          }}
        >
          <ShieldAlert size={20} /> Manual y políticas
        </button>
      </section>
    </div>
  );
};
