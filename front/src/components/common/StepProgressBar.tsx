/**
 * StepProgressBar.tsx — Barra de progreso tipo "stepper"
 *
 * PROPÓSITO:
 *   Muestra el progreso a través de varios pasos con dots
 *   que se iluminan secuencialmente. Originalmente parte de
 *   ReportModal, ahora reutilizado en SearchPage.
 *
 * CÓMO USAR:
 *   <StepProgressBar steps={[{id:1},{id:2},{id:3},{id:4}]} currentStep={2} />
 *
 * VISUAL:
 *   - Paso activo (currentStep >= id): dot lleno con color primario.
 *   - Paso inactivo: dot vacío (solo borde).
 *   - Los dots se conectan visualmente con una línea horizontal
 *     (definida en CSS por .step-progress).
 */
import React from 'react';

interface StepProgressBarProps {
  steps: { id: number; label?: string }[];
  currentStep: number;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ steps, currentStep }) => (
  <div className="step-progress">
    {steps.map((s) => (
      <div key={s.id}
        className={`step-dot ${currentStep >= s.id ? 'active' : ''}`} />
    ))}
  </div>
);
