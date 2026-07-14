import React from 'react';
import { ArrowLeft, ShieldAlert, X } from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { Button } from '../ui/Button';
import {
  StepCategory, StepVoice, StepCharacteristics, StepClothing,
  StepFeatures, StepLocation, StepSuccess,
} from './ReportSteps';
import { ReportProvider, useReport } from './ReportContext';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
}

const stepInfoMap: Record<number, { dot: number; paso: string; title: string } | null> = {
  1: { dot: 1, paso: 'Paso 1', title: '¿Qué categoría quieres reportar?' },
  2: { dot: 1, paso: 'Paso 1', title: 'Descripción de la persona' },
  3: { dot: 2, paso: 'Paso 2', title: 'Características' },
  4: { dot: 3, paso: 'Paso 3', title: 'Vestimenta' },
  5: { dot: 4, paso: 'Paso 4', title: 'Señas particulares' },
  6: { dot: 5, paso: 'Paso 5', title: 'Ubicación y envío' },
};

const ReportModalInner: React.FC = () => {
  const { step, setStep, error, setError, audioText, onClose } = useReport();

  const stepInfo = step < 7 ? stepInfoMap[step] : null;

  const renderStep = () => {
    switch (step) {
      case 1: return <StepCategory />;
      case 2: return <StepVoice />;
      case 3: return <StepCharacteristics />;
      case 4: return <StepClothing />;
      case 5: return <StepFeatures />;
      case 6: return <StepLocation />;
      case 7: return <StepSuccess />;
      default: return null;
    }
  };

  return (
    <div className="report-modal-overlay" role="dialog" aria-modal="true" aria-label={step < 7 ? 'Crear reporte' : 'Reporte finalizado'}>
      <div className="report-modal-content">
        <header className="report-modal-header">
          <div className="header-left-group">
            {step > 1 && step < 7 && (
              <button onClick={() => {
                if (step === 2) setStep(1);
                else if (step === 3) setStep(audioText ? 2 : 1);
                else setStep(s => s - 1);
              }} className="header-back-btn">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="nav-brand">
              <BrandMark size={34} />
              <span className="nav-brand-text">
                <strong>Reencuentros<span>Venezuela</span></strong>
                <small>Juntos te encontramos</small>
              </span>
            </div>
          </div>
          <button className="header-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {step < 7 && (
          <>
            <div className="step-progress">
              {[1, 2, 3, 4, 5].map(d => (
                <div key={d} className={`step-dot ${stepInfo && d <= stepInfo.dot ? 'active' : ''}`} />
              ))}
            </div>
            {step > 1 && (
              <div className="step-header">
                <div className="step-paso">{stepInfo?.paso}</div>
                <div className="step-title">{stepInfo?.title}</div>
              </div>
            )}
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

export const ReportModal: React.FC<ReportModalProps> = ({ onClose }) => (
  <ReportProvider onClose={onClose}>
    <ReportModalInner />
  </ReportProvider>
);
