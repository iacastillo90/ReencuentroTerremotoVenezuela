import React, { useState } from 'react';
import { X, Sparkles, Send, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  defaultType?: 'person' | 'animal';
}

export const ReportModal: React.FC<ReportModalProps> = ({ onClose, defaultType = 'person' }) => {
  const [type, setType] = useState<'person' | 'animal'>(defaultType);
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !estado.trim() || !text.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let photoUrl = '';
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoUrl = uploadRes.data.url;
      }

      const payload: any = {
        source: 'manual',
        externalId: `manual_${Date.now()}`,
        type,
        name: name.trim(),
        estado: estado.trim(),
        text: text.trim(),
        date: new Date().toISOString()
      };
      
      if (photoUrl) payload.photoUrl = photoUrl;

      await api.post('/persons', payload);
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Hubo un error al enviar el reporte. Por favor intenta de nuevo.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay" onClick={handleBackdropClick}>
      <div className="report-modal-content" role="dialog" aria-modal="true">
        
        <header className="report-modal-header">
          <h2 className="report-modal-title">
            Reportar {type === 'person' ? 'Desaparecido' : 'Mascota Perdida'}
          </h2>
          {!isSubmitting && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={24} />
            </button>
          )}
        </header>

        <div className="report-modal-body">
          {isSuccess ? (
            <div className="success-state">
              <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto' }} />
              <h3>¡Reporte enviado exitosamente!</h3>
              <p>Nuestra Inteligencia Artificial está analizando y organizando la información. En unos minutos aparecerá en el mapa.</p>
              <button className="btn-submit" style={{ margin: '0 auto' }} onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="ai-notice">
                <Sparkles size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Asistente de IA Activo</strong>
                  <p style={{ margin: 0, marginTop: 4 }}>
                    Escribe todo lo que sepas en el cajón de abajo. Nuestra inteligencia artificial se encargará de extraer la edad, descripciones físicas y estado de salud automáticamente, protegiendo tu privacidad.
                  </p>
                </div>
              </div>

              {error && (
                <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>¿A quién buscas?</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)}>
                  <option value="person">Persona</option>
                  <option value="animal">Mascota</option>
                </select>
              </div>

              <div className="form-group">
                <label>Nombre Completo {type === 'animal' && '(o alias de la mascota)'}</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Ej: María Elena Rodríguez" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Ubicación general (Estado, Ciudad o Zona)</label>
                <input 
                  type="text" 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)} 
                  placeholder="Ej: La Guaira, Caraballeda" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Dinos todo lo que sepas (Descripción libre)</label>
                <textarea 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder="Ej: Tiene 45 años, llevaba una camisa azul. Sufre de hipertensión y la última vez fue vista cerca de la plaza mayor. Estaba con su hijo pequeño..."
                  disabled={isSubmitting}
                ></textarea>
              </div>

              <div className="form-group">
                <label>Foto o Video Corto (MP4)</label>
                <input 
                  type="file" 
                  accept="image/*,video/mp4" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isSubmitting}
                  style={{ padding: '0.5rem' }}
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Sube una imagen clara para ayudar a la inteligencia artificial en futuras coincidencias.
                </small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 size={18} className="spinner" /> Procesando con IA...</>
                  ) : (
                    <><Send size={18} /> Enviar Reporte</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
