import React, { useState } from 'react';
import { X, Sparkles, Send, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  defaultType?: 'person' | 'animal';
}

export const ReportModal: React.FC<ReportModalProps> = ({ onClose, defaultType = 'person' }) => {
  const [reportAction, setReportAction] = useState<'busco' | 'vi'>('busco');
  const [type, setType] = useState<'person' | 'animal'>(defaultType);
  const [cedulaNac, setCedulaNac] = useState<'V' | 'E'>('V');
  const [cedula, setCedula] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [clothingQuestion, setClothingQuestion] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = Boolean(name.trim() && estado.trim() && text.trim()) && !isSubmitting;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting && !isAnalyzingImage) {
      onClose();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setIsAnalyzingImage(true);
      setClothingQuestion('');
      try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        const res = await api.post('/media/analyze-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (res.data) {
          if (res.data.permanentFeatures) {
            setText((prev) => prev ? `${prev}\nRasgos detectados en la foto: ${res.data.permanentFeatures}` : `Rasgos detectados en la foto: ${res.data.permanentFeatures}`);
          }
          if (res.data.clothingQuestion) {
            setClothingQuestion(res.data.clothingQuestion);
          }
        }
      } catch (err) {
        console.error('Error analizando imagen:', err);
      } finally {
        setIsAnalyzingImage(false);
      }
    } else {
      setClothingQuestion('');
    }
  };

  const handleVerifyCedula = async () => {
    if (!cedula.trim()) return;
    setIsVerifying(true);
    setError('');
    try {
      const res = await api.get(`/cne/${cedulaNac}/${cedula.trim()}`);
      if (res.data.valid && res.data.fullName) {
        setName(res.data.fullName);
      } else {
        setError(res.data.error || 'Cédula no encontrada. Puede ingresar el nombre manualmente.');
      }
    } catch (err: any) {
      // Fallback
      setError('No se pudo verificar con el CNE (Modo Offline/Desconectado). Ingrese el nombre manualmente.');
    } finally {
      setIsVerifying(false);
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
        // Enrich text for the AI worker to understand context and intent
        text: `${reportAction === 'vi' ? '[REPORTE: HE VISTO A ESTA PERSONA]' : '[REPORTE: ESTOY BUSCANDO A ESTA PERSONA]'} ${isAnonymous ? '[ANÓNIMO]' : ''}\n${text.trim()}`,
        date: new Date().toISOString(),
        isAnonymous
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
            Reportar
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
              <CheckCircle size={64} color="var(--clr-success)" style={{ margin: '0 auto' }} />
              <h3>¡Reporte enviado exitosamente!</h3>
              <p>Nuestra Inteligencia Artificial está analizando y organizando la información. En unos minutos aparecerá en el mapa.</p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button onClick={onClose}>
                  Cerrar
                </Button>
              </div>
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
                <div className="auth-modal-error">
                  {error}
                </div>
              )}

              <div className="form-group report-modal-form-group-row">
                <div className="report-modal-flex-1">
                  <label>¿Qué deseas reportar? <span className="required-mark">*</span></label>
                  <select value={reportAction} onChange={(e) => setReportAction(e.target.value as any)}>
                    <option value="busco">Estoy buscando a alguien</option>
                    <option value="vi">He visto a alguien</option>
                  </select>
                </div>
                <div className="report-modal-flex-1">
                  <label>Tipo <span className="required-mark">*</span></label>
                  <select value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="person">Persona</option>
                    <option value="animal">Mascota</option>
                  </select>
                </div>
              </div>

              {type === 'person' && (
                <div className="form-group">
                  <label>Verificar Identidad (CNE) <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.8em' }}>- Opcional</span></label>
                  <div className="report-modal-cne-row">
                    <select 
                      value={cedulaNac} 
                      onChange={(e) => setCedulaNac(e.target.value as 'V'|'E')}
                      style={{ width: '80px' }}
                      disabled={isSubmitting || isVerifying}
                    >
                      <option value="V">V-</option>
                      <option value="E">E-</option>
                    </select>
                    <input 
                      type="text" 
                      value={cedula} 
                      onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} 
                      placeholder="Número de Cédula" 
                      disabled={isSubmitting || isVerifying}
                      maxLength={9}
                    />
                    <Button 
                      type="button" 
                      onClick={handleVerifyCedula}
                      disabled={isSubmitting || isVerifying || !cedula}
                      variant="outline"
                    >
                      {isVerifying ? <Loader2 size={16} className="spinner" /> : 'Verificar'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Nombre Completo {type === 'animal' && '(o alias de la mascota)'} <span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Ej: María Elena Rodríguez" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Ubicación general (Estado, Ciudad o Zona) <span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)} 
                  placeholder="Ej: La Guaira, Caraballeda" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Dinos todo lo que sepas (Descripción libre) <span className="required-mark">*</span></label>
                
                <AudioRecorder 
                  onTranscription={(transcribedText) => {
                    setText((prev) => prev ? `${prev}\n${transcribedText}` : transcribedText);
                  }} 
                />

                <textarea 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder={reportAction === 'busco' ? "Ej: Tiene 45 años, llevaba una camisa azul. Sufre de hipertensión..." : "Ej: Está en el refugio de La Trinidad, llevaba una camisa azul, se ve un poco desorientado..."}
                  disabled={isSubmitting}
                ></textarea>
              </div>

              <div className="form-group report-modal-checkbox-row">
                <input 
                  type="checkbox" 
                  id="anon-checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="anon-checkbox" style={{ margin: 0, fontWeight: 'normal', cursor: 'pointer' }}>
                  Reportar de forma anónima (Ocultar mi nombre)
                </label>
              </div>

              <div className="form-group">
                <label>Foto o Video Corto (MP4)</label>
                <input 
                  type="file" 
                  accept="image/*,video/mp4" 
                  onChange={handleFileChange}
                  disabled={isSubmitting || isAnalyzingImage}
                  style={{ padding: '0.5rem' }}
                />
                
                {isAnalyzingImage && (
                  <div className="report-modal-analyzing-msg">
                    <Loader2 size={16} className="spinner" /> La IA está analizando los rasgos de la foto...
                  </div>
                )}

                {clothingQuestion && (
                  <div className="report-modal-ai-box">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Sparkles size={18} style={{ color: 'var(--clr-amber)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Pregunta del Asistente</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {clothingQuestion}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setText(prev => prev + '\nLlevaba esa misma ropa al momento de desaparecer.'); setClothingQuestion(''); }}>Sí, llevaba esa ropa</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setText(prev => prev + '\nNO llevaba esa ropa al momento de desaparecer.'); setClothingQuestion(''); }}>No llevaba eso</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Sube una imagen clara para ayudar a la inteligencia artificial en futuras coincidencias.
                </small>
              </div>

              <div className="form-actions">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? (
                    <><Loader2 size={18} className="spinner" /> Procesando con IA...</>
                  ) : (
                    <><Send size={18} /> Enviar Reporte</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
