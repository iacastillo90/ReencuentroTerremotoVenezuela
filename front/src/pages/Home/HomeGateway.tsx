import React from 'react';
import { Search, PlusCircle, Bell } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/ui/Button';
import './PublicLanding.css';
import './HomeGateway.css';

interface HomeGatewayProps {
  counts?: { missing: number; found: number; total: number };
  onBuscar: () => void;      // requiere login (gating en App)
  onReportar: () => void;    // requiere login (gating en App)
  onDirectorio: () => void;  // público
  onManual: () => void;      // público
}

/** Home público simplificado y centrado para encajar en una vista */
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        width: '100%',
        maxWidth: '400px',
        marginBottom: '3rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ fontSize: '2.8rem', fontWeight: 400, display: 'block', lineHeight: 1, marginBottom: '8px' }}>
            {counts?.total || 0}
          </strong>
          <span style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Casos reportados</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <strong style={{ fontSize: '1.5rem', fontWeight: 400, display: 'block', lineHeight: 1, marginBottom: '6px' }}>0</strong>
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.2, display: 'block' }}>
              Medios<br />registrados
            </span>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <strong style={{ fontSize: '1.5rem', fontWeight: 400, display: 'block', lineHeight: 1, marginBottom: '6px' }}>4</strong>
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.2, display: 'block' }}>
              Organizaciones<br />registradas
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <Button 
          fullWidth 
          size="lg" 
          onClick={onReportar} 
          style={{ 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            borderRadius: '999px', 
            padding: '1.1rem',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <PlusCircle size={20} /> Reportar caso
        </Button>
        
        <Button 
          fullWidth 
          size="lg" 
          variant="outline" 
          onClick={onBuscar} 
          style={{ 
            borderRadius: '999px', 
            padding: '1.1rem', 
            borderColor: '#3b82f6', 
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: 'transparent'
          }}
        >
          <Search size={20} /> Buscar personas o mascotas
        </Button>
      </div>

      {/* Communications Link */}
      <div style={{ marginTop: '3rem' }}>
        <Button 
          variant="ghost" 
          onClick={onManual} 
          style={{ 
            color: '#3b82f6',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Bell size={18} /> Ver últimos comunicados
        </Button>
      </div>
      
    </div>
  </div>
);
