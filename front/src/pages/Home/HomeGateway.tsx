/**
 * pages/Home/HomeGateway.tsx — Pantalla de inicio pública (no logueado)
 *
 * PROPÓSITO:
 *   Versión simplificada de HomePage para usuarios no autenticados.
 *   Muestra la marca, estadísticas generales y botones de acción
 *   que redirigen al login/flujo correspondiente.
 *
 * DIFERENCIAS CON HomePage:
 *   - No tiene imagen de fondo.
 *   - Los botones de acción disparan el gating de auth en App.tsx.
 *   - Tiene enlace a "Ver últimos comunicados".
 *   - El gating (mostrar login si no autenticado) se maneja en App.tsx,
 *     no aquí.
 *
 * BOTONES:
 *   - "Reportar caso" → onReportar (App hace gate → AuthModal).
 *   - "Buscar personas" → onBuscar (App hace gate → AuthModal).
 *   - "Ver últimos comunicados" → onManual (público, sin gate).
 */
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
  <div className="public-landing hg" style={{ height: '100%', minHeight: '100%', backgroundColor: '#070c14', overflow: 'hidden' }}>
    <div className="pl__bg" />
    <div className="hg__inner" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100%',
      padding: '1rem',
      textAlign: 'center'
    }}>

      {/* Brand Header */}
      <div className="hg__brand" style={{ justifyContent: 'center', marginBottom: '2.5rem' }}>
        <BrandMark size={44} />
        <div className="hg__brand-text" style={{ textAlign: 'left', marginLeft: '12px' }}>
          <span className="hg__brand-name" style={{ fontSize: '1.3rem' }}>
            Reencuentros <span style={{ color: '#3b82f6', fontWeight: 500 }}>Venezuela</span>
          </span>
          <small style={{ fontSize: '0.7rem', letterSpacing: '1px', opacity: 0.8 }}>
            JUNTOS TE ENCONTRAMOS
          </small>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ marginBottom: '3rem', width: '100%' }}>
        <HomeStats counts={counts as any} />
      </div>

      {/* Action Buttons */}
      <div style={{ width: '100%', maxWidth: '358px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
      </div>

      {/* Communications Link */}
      <div style={{ marginTop: '3rem' }}>
        <button
          onClick={onManual}
          style={{
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
          <Bell size={20} /> Ver últimos comunicados
        </button>
      </div>

    </div>
  </div>
);
