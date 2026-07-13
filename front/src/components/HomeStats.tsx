import React from 'react';

interface HomeStatsProps {
  counts?: { missing: number; found: number; total: number };
}

export const HomeStats: React.FC<HomeStatsProps> = ({ counts }) => {
  return (
    <div className="home-stats">
      <div className="home-stats__total">
        <strong className="home-stats__number">
          {counts?.total || 0}
        </strong>
        <span className="home-stats__label">Casos reportados</span>
      </div>
      <div className="home-stats__grid">
        <div className="home-stats__item">
          <strong className="home-stats__digit">0</strong>
          <span className="home-stats__desc">
            Medios<br />registrados
          </span>
        </div>
        <div className="home-stats__item">
          <strong className="home-stats__digit">4</strong>
          <span className="home-stats__desc">
            Organizaciones<br />registradas
          </span>
        </div>
      </div>
    </div>
  );
};
