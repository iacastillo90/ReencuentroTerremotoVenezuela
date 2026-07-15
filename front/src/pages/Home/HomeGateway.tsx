import React from 'react';
import { Search, Plus, Bell } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { HomeStats } from '../../components/HomeStats';
import { HomeActionCard } from '../../components/HomeActionCard';
import './PublicLanding.css';
import './HomeGateway.css';

interface HomeGatewayProps {
  counts?: { missing: number; found: number; total: number };
  onBuscar: () => void;
  onReportar: () => void;
  onDirectorio: () => void;
  onManual: () => void;
}

export const HomeGateway: React.FC<HomeGatewayProps> = ({ counts, onBuscar, onReportar, onManual }) => (
  <div className="public-landing hg hg--gateway">
    <div className="pl__bg" />
    <div className="hg__inner">

      <div className="hg__stats-section">
        <HomeStats counts={counts} />
      </div>
      <div className="hg__actions">
        <HomeActionCard
          icon={<Plus size={18} strokeWidth={2} />}
          title="Reportar caso"
          onClick={onReportar}
          className="hg__btn hg__btn--primary"
        />
        <HomeActionCard
          icon={<Search size={18} strokeWidth={2} />}
          title="Buscar personas o mascotas"
          onClick={onBuscar}
          className="hg__btn hg__btn--outline"
        />
      </div>

    </div>
  </div>
);
