/**
 * components/HomeStats.tsx — Estadísticas de la homepage
 *
 * PROPÓSITO:
 *   Muestra las cifras principales en la página de inicio:
 *   - Total de casos reportados.
 *   - Medios registrados.
 *   - Organizaciones registradas.
 *
 * NOTA:
 *   Este componente usa estilos inline porque sus valores
 *   (colores, tamaños de fuente) son únicos de la homepage
 *   y no se repiten en ningún otro lugar. No justifica
 *   una clase CSS dedicada.
 *
 * USO:
 *   <HomeStats counts={{ missing: 150, found: 80, total: 230 }} />
 */
import React from 'react';

interface HomeStatsProps {
  counts?: { missing: number; found: number; total: number };
}

export const HomeStats: React.FC<HomeStatsProps> = ({ counts }) => {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2rem',
      width: '100%', maxWidth: '400px', margin: '0 auto',
    }}>
      {/* Total de casos reportados */}
      <div style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: '2.8rem', fontWeight: 400, display: 'block',
          lineHeight: 1, marginBottom: '8px', color: '#fff' }}>
          {counts?.total || 0}
        </strong>
        <span style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Casos reportados</span>
      </div>
      {/* Medios y organizaciones */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong style={{ fontSize: '1.5rem', fontWeight: 400, display: 'block',
            lineHeight: 1, marginBottom: '6px', color: '#fff' }}>0</strong>
          <span style={{ fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.2, display: 'block' }}>
            Medios<br />registrados
          </span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong style={{ fontSize: '1.5rem', fontWeight: 400, display: 'block',
            lineHeight: 1, marginBottom: '6px', color: '#fff' }}>4</strong>
          <span style={{ fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.2, display: 'block' }}>
            Organizaciones<br />registradas
          </span>
        </div>
      </div>
    </div>
  );
};
