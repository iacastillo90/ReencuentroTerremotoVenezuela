/**
 * ModalOverlay.tsx — Modal genérico con backdrop
 *
 * PROPÓSITO:
 *   Overlay de modal reutilizable con backdrop semitransparente,
 *   header opcional, contenido scrolleable y animación de entrada.
 *
 * POR QUÉ UN COMPONENTE:
 *   ReportModal, AuthModal y PersonDetailModal compartían ~80%
 *   de la misma estructura (overlay, header, botón cerrar, body).
 *   Este componente unifica ese patrón.
 *
 * CÓMO USAR:
 *   <ModalOverlay isOpen={true} onClose={handleClose} title="Título">
 *     <p>Contenido del modal</p>
 *   </ModalOverlay>
 *
 * COMPORTAMIENTO:
 *   - No renderiza nada si isOpen es false (retorna null).
 *   - Cierra al hacer click fuera del contenido (backdrop).
 *   - El contenido usa maxWidth (default 600px) para no ser
 *     demasiado ancho en pantallas grandes.
 *   - role="dialog" y aria-modal para accesibilidad.
 */
import React, { useEffect } from 'react';

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  maxWidth = '600px',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // No renderiza nada si el modal está cerrado.
  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" role="dialog" aria-modal="true"
      aria-label={title || 'Modal'} onClick={onClose}
      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className={`report-modal-content ${className}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header opcional con título y botón cerrar */}
        {title && (
          <header className="report-modal-header">
            <h2>{title}</h2>
            <button className="header-close-btn" onClick={onClose} aria-label="Cerrar">
              <span aria-hidden="true">&times;</span>
            </button>
          </header>
        )}
        {/* Body scrolleable */}
        <div className="report-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
