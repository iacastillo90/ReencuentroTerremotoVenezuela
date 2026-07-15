import React, { useState, useEffect } from 'react';
import { CheckCircle, Info, Loader2, MapPin, ShieldAlert, Sparkles, Video, WifiOff, ArrowLeft, Mic, X } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import { CustomSelect, CategorySelector, DEFAULT_CATEGORIES } from '../common';
import { COLORS_PIEL, COLORS_CABELLO, COLORS_OJOS, COMPLEXION, SENAS } from './reportFormConstants';
import { useReport } from './ReportContext';
import { ModeToggle } from './ModeToggle';
import { extraerDatosDeAudio } from './iaExtractor';



/* ─── PASO 1: SELECCIÓN DE CATEGORÍA ─── */

export const StepCategory: React.FC = () => {
  const { categoria, setCategoria, setStep } = useReport();
  const [modo, setModo] = useState<'manual' | 'ia'>('manual');

  return (
    <div className="report-step-content">
      <ModeToggle modo={modo} setModo={setModo} onIaClick={() => setStep(2)} style={{ margin: '0 auto 20px auto' }} />

      <div className="step-paso-heading" style={{ flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
        <span className="step-paso-num">Paso 1</span>
        <span className="step-paso-desc" style={{ display: 'flex', alignItems: 'center' }}>¿Qué categoría quieres reportar?</span>
      </div>

      <div style={{
        width: '100%',
        minHeight: '80px',
        borderRadius: '8px',
        border: '1px solid #444444',
        backgroundColor: '#191919',
        padding: '16px',
        gap: '12px',
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <WifiOff size={24} color="#94A3B8" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '14px', color: '#E2E8F0', lineHeight: '1.4', fontWeight: 500, paddingRight: '16px', maxWidth: '260px' }}>
          El reporte lo puedes hacer incluso si no tienes señal.
        </span>
      </div>

      <CategorySelector categories={DEFAULT_CATEGORIES} selected={categoria} onSelect={setCategoria} />

      <div className="sticky-bottom-action">
        <div className="step-submit-row">
          <Button fullWidth size="lg" onClick={() => setStep(3)} disabled={!categoria}>SIGUIENTE</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── PASO 2: ASISTENTE DE VOZ / DESCRIPCIÓN ─── */

export const StepVoice: React.FC = () => {
  const { 
    audioText, setAudioText, setStep, resetFields,
    setGenero, setEdad, setPiel, setCabello, setOjos, setDetallesVestimenta
  } = useReport();
  const [view, setView] = useState<'initial' | 'recording' | 'done'>('initial');
  const [isRecording, setIsRecording] = useState(false);
  const [modo, _setModo] = useState<'manual' | 'ia'>('ia');
  const hasText = audioText.trim().length > 0;


  const handleGrabarClick = () => {
    resetFields();
    setView('recording');
  };

  const handleReGrabar = () => {
    resetFields();
    setView('recording');
  };

  const handleCloseRecording = () => {
    setView('initial');
  };

  const handleConfirmarYExtraer = () => {
    const data = extraerDatosDeAudio(audioText);
    
    if (data.genero) setGenero(data.genero);
    if (data.edad) setEdad(data.edad);
    if (data.piel) setPiel(data.piel);
    if (data.cabello) setCabello(data.cabello);
    if (data.ojos) setOjos(data.ojos);
    if (data.detallesVestimenta) setDetallesVestimenta(data.detallesVestimenta);

    setStep(3);
  };

  if (view === 'recording') {
    return (
      <div className="report-step-content">
        <ModeToggle modo={modo} setModo={(m) => { if (m === 'manual') setStep(3); }} />

        <div className="step-paso-heading" style={{ flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
          <span className="step-paso-num">Paso 1</span>
          <span className="step-paso-desc" style={{ display: 'flex', alignItems: 'center' }}>Descripción de la persona</span>
        </div>

        <div className="step-recording-content">
          <button type="button" onClick={handleCloseRecording} className="step-recording-close" aria-label="Cerrar">
            <X size={24} />
          </button>

          <div className="step-recording-status-text">
            {isRecording ? 'Grabando...' : (hasText ? 'Grabación finalizada' : 'Procesando audio...')}
          </div>

          <div className="step-recording-waveform">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="step-recording-bar" />
            ))}
          </div>

          <div className="step-recorder-wrapper">
            <AudioRecorder
              compact
              autoStart
              currentText={audioText}
              onStartRecording={() => setIsRecording(true)}
              onStopRecording={() => setIsRecording(false)}
              onTranscription={(txt) => setAudioText(txt)}
            />
          </div>
        </div>

        <div className="figma-footer-section">
          <div className="report-footer-privacy">
            <Info size={14} />
            <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
          </div>
          <Button fullWidth size="lg" disabled={isRecording || !hasText} onClick={() => setView('done')}>
            Ir a confirmar datos
          </Button>
        </div>
      </div>
    );
  }

  if (view === 'done' && hasText) {
    return (
      <div className="report-step-content">
        <ModeToggle modo={modo} setModo={(m) => { if (m === 'manual') setStep(3); }} />

        <div className="step-paso-heading" style={{ flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
          <span className="step-paso-num">Paso 1</span>
          <span className="step-paso-desc" style={{ display: 'flex', alignItems: 'center' }}>Descripción de la persona</span>
        </div>

        <div className="figma-input-field">
          <label>DESCRIPCIÓN</label>
          <textarea
            value={audioText}
            onChange={(e) => setAudioText(e.target.value)}
            placeholder="Ejemplo: Adulto de 55 años, con una cicatriz en la cara..."
            rows={5}
          />
          <div className="figma-voice-actions dark-record-btn-override">
            <Button type="button" variant="outline" size="md" fullWidth onClick={handleReGrabar}>
              <Mic size={16} /> Volver a grabar
            </Button>
          </div>
        </div>

        <div className="figma-footer-section">
          <div className="report-footer-privacy">
            <Info size={14} />
            <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
          </div>
          <Button fullWidth size="lg" onClick={handleConfirmarYExtraer}>
            Ir a confirmar datos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-step-content">
      <ModeToggle modo={modo} setModo={(m) => { if (m === 'manual') setStep(3); }} />

      <div className="step-paso-heading" style={{ flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}>
        <span className="step-paso-num">Paso 1</span>
        <span className="step-paso-desc" style={{ display: 'flex', alignItems: 'center' }}>Descripción de la persona</span>
      </div>

      <span style={{ color: '#CDCFD1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Info size={14} /> ¿No tienes señal?
      </span>

      <div className="figma-ai-alert">
        <div className="figma-ai-alert-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <div className="figma-ai-alert-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#4497D6" />
            <span className="figma-ai-alert-title">Asistente IA de Voz</span>
          </div>
          <p className="figma-ai-alert-desc" style={{ textAlign: 'left', margin: 0, lineHeight: 1.4 }}>
            Graba una nota de voz de la persona/mascota indicando su nombre, edad, y características físicas. La IA lo transcribirá automáticamente.
          </p>
        </div>
        <div className="dark-record-btn-override" style={{ marginTop: '16px' }}>
          <Button type="button" variant="primary" size="lg" fullWidth onClick={handleGrabarClick}>
            <Mic size={20} /> Grabar
          </Button>
        </div>
      </div>

      <div className="figma-footer-section">
        <div className="report-footer-privacy">
          <Info size={14} />
          <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
        </div>
        <Button fullWidth size="lg" onClick={() => setStep(3)}>
          Ir a confirmar datos
        </Button>
      </div>
    </div>
  );
};

/* ─── PASO 3: CARACTERÍSTICAS FÍSICAS ─── */

export const StepCharacteristics: React.FC = () => {
  const { genero, setGenero, nombreCompleto, setNombreCompleto, edad, setEdad, complexion, setComplexion, piel, setPiel, cabello, setCabello, ojos, setOjos, detallesVestimenta, setDetallesVestimenta, setStep, audioText } = useReport();
  const [modo, setModo] = useState<'manual' | 'ia'>('manual');

  return (
    <div className="report-step-content">
      <ModeToggle modo={modo} setModo={setModo} onIaClick={() => setStep(2)} />

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: 'min(50px, 10vw)' }}>
        <button type="button" onClick={() => setStep(audioText ? 2 : 1)} style={{
          background: 'none',
          border: '1px solid #CDCFD1',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          padding: '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ArrowLeft size={18} color="#CDCFD1" />
        </button>
        <div className="step-paso-heading" style={{ margin: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
          <span className="step-paso-num">Paso 2</span>
          <span style={{ fontSize: '15px', fontWeight: 400, color: '#CDCFD1' }}>Características</span>
        </div>
      </div>

      <div className="figma-section">
        <div className="figma-card-group">
          <button type="button" onClick={() => setGenero('Masculino')}
            className={`figma-card-gender ${genero === 'Masculino' ? 'selected' : ''}`}>
            <span className="gender-icon">♂</span>
            <span className="gender-label">Masculino</span>
          </button>
          <button type="button" onClick={() => setGenero('Femenino')}
            className={`figma-card-gender ${genero === 'Femenino' ? 'selected' : ''}`}>
            <span className="gender-icon">♀</span>
            <span className="gender-label">Femenino</span>
          </button>
        </div>
      </div>



      <div className="figma-input-field">
        <label>Edad</label>
        <input type="number" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="¿Qué edad tiene la persona?" />
      </div>

      <div className="figma-section">
        <label className="figma-section-label">Complexión</label>
        <div className="figma-card-group">
          {COMPLEXION.map((c) => (
            <button key={c.val} type="button" onClick={() => setComplexion(c.val)}
              className={`figma-card ${complexion === c.val ? 'selected' : ''}`}>
              <strong>{c.title}</strong>
              <span>{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <CustomSelect label="Color de piel" options={COLORS_PIEL} value={piel} onChange={setPiel} placeholder="Seleccionar" />
      <CustomSelect label="Color de cabello" options={COLORS_CABELLO} value={cabello} onChange={setCabello} placeholder="Seleccionar" />
      <CustomSelect label="Color de ojos" options={COLORS_OJOS} value={ojos} onChange={setOjos} placeholder="Seleccionar" />

      <div className="figma-input-field">
        <label>DETALLES DE VESTIMENTA (Opcional)</label>
        <textarea
          value={detallesVestimenta}
          onChange={(e) => setDetallesVestimenta(e.target.value)}
          placeholder="Ej. Camisa roja, pantalón azul, gorra negra..."
          rows={3}
        />
      </div>


      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => setStep(4)}>SIGUIENTE</Button>
      </div>
    </div>
  );
};


/* ─── PASO 5: SEÑAS PARTICULARES ─── */

export const StepFeatures: React.FC = () => {
  const { senasSelected, toggleSena, detalleAdicional, setDetalleAdicional, setStep } = useReport();
  const [modo, setModo] = useState<'manual' | 'ia'>('manual');
  return (
    <div className="report-step-content">
      <ModeToggle modo={modo} setModo={setModo} onIaClick={() => setStep(2)} style={{ margin: '0 auto 16px auto' }} />

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: 'min(50px, 10vw)' }}>
        <button type="button" onClick={() => setStep(3)} style={{
          background: 'none',
          border: '1px solid #CDCFD1',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          padding: '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ArrowLeft size={18} color="#CDCFD1" />
        </button>
        <div className="step-paso-heading" style={{ margin: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
          <span className="step-paso-num">Paso 3</span>
          <span style={{ fontSize: '15px', fontWeight: 400, color: '#CDCFD1' }}>Señas particulares</span>
        </div>
      </div>
      <div className="figma-section">
        <label className="figma-section-label">Selecciona las que apliquen</label>
        <div className="figma-feature-btn-group">
          {SENAS.map((s) => {
            const active = senasSelected.includes(s.val);
            return (
              <button key={s.val} type="button" onClick={() => toggleSena(s.val)}
                className={`figma-feature-btn ${active ? 'active' : ''}`}>
                <div className="radio-circle" />
                <div className="feature-text">
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="figma-input-field">
        <label>DETALLE ADICIONAL / DESCRIPCIÓN</label>
        <textarea rows={3} value={detalleAdicional}
          onChange={(e) => setDetalleAdicional(e.target.value)}
          placeholder="Ej. Cicatriz en antebrazo derecho, llevaba un bolso negro..." />
      </div>
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => setStep(5)}>SIGUIENTE</Button>
      </div>
    </div>
  );
};

/* ─── PASO 6: UBICACIÓN Y ENVÍO ─── */

export const StepLocation: React.FC = () => {
  const { categoria, file, handleFileChange, requestLocation, isRequestingLocation, locationSuccess, calleEstado, setCalleEstado, reporterLocation, isSubmitting, submitReport, setStep } = useReport();
  const [modo, setModo] = useState<'manual' | 'ia'>('manual');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  return (
    <div className="report-step-content">
      <ModeToggle modo={modo} setModo={setModo} onIaClick={() => setStep(2)} style={{ margin: '0 auto 4px auto' }} />

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', gap: 'min(50px, 10vw)' }}>
        <button type="button" onClick={() => setStep(4)} style={{
          background: 'none',
          border: '1px solid #CDCFD1',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          padding: '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ArrowLeft size={18} color="#CDCFD1" />
        </button>
        <div className="step-paso-heading" style={{ margin: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
          <span className="step-paso-num">Paso 4</span>
          <span style={{ fontSize: '15px', fontWeight: 400, color: '#CDCFD1' }}>Grabar video/Tomar foto</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '358px', margin: '0 auto 2px auto', textAlign: 'left' }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 400, color: '#CDCFD1' }}>Asegúrate de que el video o foto se vea lo más claro posible</h2>
      </div>

      {categoria === 'niño/a o adolescente' ? (
        <div className="figma-alert-danger">
          <ShieldAlert size={36} color="#ef4444" className="centered-icon" />
          <strong>Protección al Menor (LOPNNA)</strong>
          <p>Por ley, no está permitido adjuntar fotografías o videos de menores de edad.
            Su reporte será enviado directamente a las autoridades correspondientes para un manejo confidencial.</p>
        </div>
      ) : (
        <label className="figma-upload-area" style={{ position: 'relative', overflow: 'hidden', height: '220px', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#07101C' }}>
          <input type="file" accept="image/*,video/mp4" onChange={handleFileChange} />
          {previewUrl ? (
            file?.type.startsWith('video/') ? (
              <video src={previewUrl} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain', top: 0, left: 0, zIndex: 0 }} autoPlay muted loop playsInline />
            ) : (
              <img src={previewUrl} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain', top: 0, left: 0, zIndex: 0 }} alt="Preview" />
            )
          ) : (
            <div style={{ zIndex: 1, position: 'relative', pointerEvents: 'none' }}>
              <Video size={48} color="#94a3b8" className="centered-icon" style={{ margin: '0 auto 16px auto' }} />
              <strong style={{ display: 'block', fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Subir Evidencia (Foto o Video)</strong>
              <span style={{ color: '#94A3B8', fontSize: '14px' }}>Toca para abrir la cámara o galería</span>
            </div>
          )}
          {previewUrl && (
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '20px', zIndex: 1, fontSize: '12px', color: '#fff', whiteSpace: 'nowrap' }}>
              Tocar para cambiar
            </div>
          )}
        </label>
      )}
      <div style={{ width: '100%', maxWidth: '358px', margin: '10px auto', textAlign: 'left' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#9CA0A4' }}>Añade la ubicación del reporte:</span>
      </div>
      <button type="button" onClick={requestLocation}
        disabled={isRequestingLocation || locationSuccess}
        className={`figma-location-btn ${locationSuccess ? 'success' : ''}`}
        style={locationSuccess ? { marginBottom: '4px', color: '#3b82f6', borderColor: '#3b82f6' } : { marginBottom: '4px' }}>
        {isRequestingLocation ? <Loader2 className="spinner" size={20} /> : <MapPin size={20} />}
        {locationSuccess ? 'Ubicación Adjuntada' : 'Añadir mi Ubicación actual'}
      </button>
      <div className="figma-input-field">
        <input type="text" value={calleEstado} onChange={(e) => setCalleEstado(e.target.value)}
          placeholder="Calle y estado..." />
      </div>
      {reporterLocation && (
        <div className="location-card">
          <div className="location-card-icon">
            <MapPin size={24} color="#34d399" />
          </div>
          <div className="location-card-body">
            <span className="location-card-title">Ubicación adjunta</span>
            <span className="location-card-meta">Lat: {reporterLocation.lat.toFixed(4)} | Lng: {reporterLocation.lng.toFixed(4)}</span>
            <span className="location-card-meta">IP: Obtenida por el sistema</span>
          </div>
          <CheckCircle size={20} color="#34d399" className="location-card-check" />
        </div>
      )}
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={submitReport} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spinner" size={20} /> : 'SUBIR'}
        </Button>
      </div>
    </div>
  );
};

/* ─── PASO 7: ÉXITO / CONFIRMACIÓN ─── */

export const StepSuccess: React.FC = () => {
  const { isOfflineSaved, onClose, setStep, resetFields } = useReport();
  return (
    <div className="report-step-content-centered">
      {isOfflineSaved ? (
        <>
          <WifiOff size={80} color="#f59e0b" className="success-hero-icon" />
          <h3 className="success-heading">Guardado en Modo Sin Conexión</h3>
          <p className="success-description">
            El reporte ha sido guardado de manera local. Se sincronizará automáticamente
            tan pronto como tu dispositivo recupere conexión a Internet.
          </p>
        </>
      ) : (
        <>
          <CheckCircle size={80} color="#10b981" className="success-hero-icon" />
          <h3 className="success-heading">Reporte recibido</h3>
          <p className="success-description">Cada solicitud será validada por nuestro equipo técnico previo a su publicación, para garantizar la privacidad y seguridad de la persona o mascota reportada.</p>
        </>
      )}
      <div className="success-actions">
        <Button fullWidth size="lg" onClick={onClose}>Entendido</Button>
      </div>
    </div>
  );
};
