import React from 'react';
import { ShieldAlert, X, User } from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { Button } from '../ui/Button';
import {
  StepCategory, StepVoice, StepCharacteristics,
  StepFeatures, StepLocation, StepSuccess,
} from './ReportSteps';
import { ReportProvider, useReport } from './ReportContext';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

const stepInfoMap: Record<number, { dot: number; paso: string; title: string } | null> = {
  1: { dot: 1, paso: 'Paso 1', title: '¿Qué categoría quieres reportar?' },
  2: { dot: 1, paso: 'Paso 1', title: 'Descripción de la persona' },
  3: { dot: 2, paso: 'Paso 2', title: 'Características' },
  4: { dot: 3, paso: 'Paso 3', title: 'Señas particulares' },
  5: { dot: 4, paso: 'Paso 4', title: 'Ubicación y envío' },
};

const ReportModalInner: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const { step, error, setError, onClose } = useReport();

  const stepInfo = step < 7 ? stepInfoMap[step] : null;

  const renderStep = () => {
    switch (step) {
      case 1: return <StepCategory />;
      case 2: return <StepVoice />;
      case 3: return <StepCharacteristics />;
      case 4: return <StepFeatures />;
      case 5: return <StepLocation />;
      case 6: return <StepSuccess />;
      default: return null;
    }
  };

  return (
    <div className="report-modal-overlay" role="dialog" aria-modal="true" aria-label={step < 6 ? 'Crear reporte' : 'Reporte finalizado'}>
      <div className="report-modal-content">
        <header className="report-modal-header">
          <div className="header-left-group">

            <div className="nav-brand">
              <BrandMark size={34} />
              <span className="nav-brand-text">
                <strong>Reencuentros<span>Venezuela</span></strong>
                <small>Juntos te encontramos</small>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="nav-profile" onClick={() => {
              onClose();
              if (onNavigate) onNavigate('profile');
            }} aria-label="Perfil">
              <div className="profile-circle">
                <User size={20} />
              </div>
            </button>
            <button className="header-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
        </header>

        {step < 6 && (
          <>
            <div className="step-progress">
              {[1, 2, 3, 4].map(d => (
                <div key={d} className={`step-dot ${stepInfo && d <= stepInfo.dot ? 'active' : ''}`} />
              ))}
            </div>
          </>
        )}

        <div className="report-modal-body">
          <div key={step} className="step-animated-container">{renderStep()}</div>
        </div>
      </div>

      {error && (
        <div className="error-overlay">
          <div className="error-card">
            <ShieldAlert size={40} color="#ef4444" className="error-card-icon" />
            <strong className="error-card-title">Atención</strong>
            <p className="error-card-message">{error}</p>
            <Button fullWidth onClick={() => setError('')} className="error-card-btn">Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReportModal: React.FC<ReportModalProps> = ({ onClose, onNavigate }) => (
  <ReportProvider onClose={onClose}>
    <ReportModalInner onNavigate={onNavigate} />
  </ReportProvider>
);
