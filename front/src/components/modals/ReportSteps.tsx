import React, { useState } from 'react';
import { CheckCircle, Info, Loader2, MapPin, Plus, ShieldAlert, Sparkles, Video, WifiOff } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import { CustomSelect, CategorySelector, DEFAULT_CATEGORIES } from '../common';
import { COLORS_PIEL, COLORS_CABELLO, COLORS_OJOS, COMPLEXION, SENAS } from './reportFormConstants';
import { useReport } from './ReportContext';

/* ─── PASO 1: SELECCIÓN DE CATEGORÍA ─── */

export const StepCategory: React.FC = () => {
  const { categoria, setCategoria, setStep } = useReport();
  const [modo, setModo] = useState<'manual' | 'ia'>('manual');

  return (
    <div className="report-step-content">
      <div className="figma-toggle">
        <button type="button" onClick={() => setModo('manual')}
          className={`figma-toggle-btn ${modo === 'manual' ? 'active' : ''}`}>
          Manual
        </button>
        <button type="button" onClick={() => { setModo('ia'); setStep(2); }}
          className={`figma-toggle-btn ${modo === 'ia' ? 'active' : ''}`}>
          <Sparkles size={16} /> Con IA
        </button>
      </div>

      <div className="step-paso-heading">
        <span className="step-paso-num">Paso 1</span>
        <span className="step-paso-desc">¿Qué categoría quieres reportar?</span>
      </div>

      <div className="figma-alert-card">
        <Sparkles size={20} className="figma-alert-icon" />
        <div className="figma-alert-body">
          <strong>Reportar con Asistente IA</strong>
          <p>Usa el asistente de voz. Trata de mencionar detalles como si es niño/adulto, cómo está vestido y características físicas.</p>
        </div>
        <button type="button" onClick={() => setStep(2)} className="figma-alert-btn">
          <Sparkles size={16} /> Usar
        </button>
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
  const { audioText, setAudioText, setStep, resetFields } = useReport();
  return (
    <div className="report-step-content">
      <div className="ai-notification-card">
        <div className="card-title">
          <Sparkles size={20} color="#4497D6" />
          <span>Asistente IA de Voz</span>
        </div>
        <p className="card-description">
          Usa el asistente de voz. Trata de mencionar detalles como si es niño/adulto,
          cómo está vestido y características físicas.
        </p>
      </div>
      <AudioRecorder
        currentText={audioText}
        onStartRecording={resetFields}
        onTranscription={(txt) => setAudioText(txt)}
      />
      <div className="figma-input-field">
        <label>DESCRIPCIÓN (o transcribe con el asistente de voz)</label>
        <textarea
          value={audioText}
          onChange={(e) => setAudioText(e.target.value)}
          placeholder="Ejemplo: Adulto de 55 años, con una cicatriz en la cara..."
          rows={6}
        />
      </div>
      <div className="sticky-bottom-action">
        <div className="report-footer-privacy">
          <Info size={14} />
          <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
        </div>
        <div className="step-submit-row-flex">
          <Button variant="outline" size="lg" onClick={() => setStep(1)}>ATRÁS</Button>
          <Button fullWidth size="lg" onClick={() => setStep(3)}>SIGUIENTE</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── PASO 3: CARACTERÍSTICAS FÍSICAS ─── */

export const StepCharacteristics: React.FC = () => {
  const { genero, setGenero, nombreCompleto, setNombreCompleto, edad, setEdad, complexion, setComplexion, piel, setPiel, cabello, setCabello, ojos, setOjos, setStep } = useReport();
  return (
    <div className="report-step-content">
      <div className="figma-section">
        <label className="figma-section-label">Género</label>
        <div className="figma-card-group">
          {['Masculino', 'Femenino'].map((g) => (
            <button key={g} type="button" onClick={() => setGenero(g)}
              className={`figma-card-gender ${genero === g ? 'selected' : ''}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="figma-input-field">
        <label>NOMBRE (Opcional)</label>
        <input type="text" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)}
          placeholder="¿Conoces el nombre de esta persona?" />
      </div>
      <div className="figma-input-field">
        <label>EDAD APROXIMADA (Opcional)</label>
        <input type="number" value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="Ej. 25" />
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
      <CustomSelect label="Color de piel" options={COLORS_PIEL} value={piel} onChange={setPiel} placeholder="Seleccionar color" />
      <CustomSelect label="Color de cabello" options={COLORS_CABELLO} value={cabello} onChange={setCabello} placeholder="Seleccionar color" />
      <CustomSelect label="Color de ojos" options={COLORS_OJOS} value={ojos} onChange={setOjos} placeholder="Seleccionar color" />
      <div className="report-footer-privacy">
        <Info size={14} />
        <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
      </div>
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => setStep(4)}>ACEPTAR</Button>
      </div>
    </div>
  );
};

/* ─── PASO 4: VESTIMENTA ─── */

export const StepClothing: React.FC = () => {
  const { prendaSup, setPrendaSup, colorSup, setColorSup, prendaInf, setPrendaInf, colorInf, setColorInf, sinVestimenta, setSinVestimenta, setStep } = useReport();
  return (
    <div className="report-step-content">
      <div className={sinVestimenta ? 'figma-muted-group' : ''}>
        <div className="figma-input-field">
          <label>PRENDA SUPERIOR</label>
          <input type="text" list="prenda-sup-opts" value={prendaSup}
            onChange={(e) => setPrendaSup(e.target.value)} placeholder="Ej: Camisa, sueter..." />
          <datalist id="prenda-sup-opts">
            <option value="Camisa"/><option value="Sueter"/><option value="Sin camisa"/>
            <option value="Franela"/><option value="Camisa sin manga"/>
          </datalist>
        </div>
        <div className="figma-input-field">
          <label>COLOR PRENDA SUPERIOR</label>
          <input type="text" value={colorSup} onChange={(e) => setColorSup(e.target.value)}
            placeholder="Ej: Rojo, Azul marino..." />
        </div>
        <div className="figma-input-field">
          <label>PRENDA INFERIOR</label>
          <input type="text" list="prenda-inf-opts" value={prendaInf}
            onChange={(e) => setPrendaInf(e.target.value)} placeholder="Ej: Pantalón, short..." />
          <datalist id="prenda-inf-opts">
            <option value="Pantalon"/><option value="Short"/><option value="Jean"/>
            <option value="Mono"/><option value="Licra"/><option value="Falda"/>
          </datalist>
        </div>
        <div className="figma-input-field">
          <label>COLOR PRENDA INFERIOR</label>
          <input type="text" value={colorInf} onChange={(e) => setColorInf(e.target.value)}
            placeholder="Ej: Negro, Azul claro..." />
        </div>
      </div>
      <label className="figma-checkbox-row">
        <input type="checkbox" checked={sinVestimenta}
          onChange={(e) => setSinVestimenta(e.target.checked)} />
        <span>No tengo información de esto</span>
      </label>
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => setStep(5)}>ACEPTAR</Button>
      </div>
    </div>
  );
};

/* ─── PASO 5: SEÑAS PARTICULARES ─── */

export const StepFeatures: React.FC = () => {
  const { senasSelected, toggleSena, detalleAdicional, setDetalleAdicional, setStep } = useReport();
  return (
    <div className="report-step-content">
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
      <div className="figma-input-field">
        <label>DETALLE ADICIONAL / DESCRIPCIÓN</label>
        <textarea rows={3} value={detalleAdicional}
          onChange={(e) => setDetalleAdicional(e.target.value)}
          placeholder="Ej. Cicatriz en antebrazo derecho, llevaba un bolso negro..." />
      </div>
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => setStep(6)}>ACEPTAR</Button>
      </div>
    </div>
  );
};

/* ─── PASO 6: UBICACIÓN Y ENVÍO ─── */

export const StepLocation: React.FC = () => {
  const { categoria, file, handleFileChange, requestLocation, isRequestingLocation, locationSuccess, calleEstado, setCalleEstado, reporterLocation, isSubmitting, submitReport } = useReport();
  return (
    <div className="report-step-content">
      {categoria === 'niño/a o adolescente' ? (
        <div className="figma-alert-danger">
          <ShieldAlert size={36} color="#ef4444" className="centered-icon" />
          <strong>Protección al Menor (LOPNNA)</strong>
          <p>Por ley, no está permitido adjuntar fotografías o videos de menores de edad.
            Su reporte será enviado directamente a las autoridades correspondientes para un manejo confidencial.</p>
        </div>
      ) : (
        <label className="figma-upload-area">
          <input type="file" accept="image/*,video/mp4" onChange={handleFileChange} />
          <Video size={48} color="#94a3b8" className="centered-icon" />
          <strong>Subir Evidencia (Foto o Video)</strong>
          <span>{file ? file.name : 'Toca para abrir la cámara o galería'}</span>
        </label>
      )}
      <button type="button" onClick={requestLocation}
        disabled={isRequestingLocation || locationSuccess}
        className={`figma-location-btn ${locationSuccess ? 'success' : ''}`}>
        {isRequestingLocation ? <Loader2 className="spinner" size={20} /> : <MapPin size={20} />}
        {locationSuccess ? 'Ubicación Adjuntada' : 'Añadir mi Ubicación actual'}
      </button>
      <div className="figma-input-field">
        <label>CALLE Y ESTADO (Opcional)</label>
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
          <h3 className="success-heading">¡Tu reporte se ha realizado exitosamente!</h3>
          <p className="success-description">Nos comunicaremos contigo en caso de necesitar información extra.</p>
        </>
      )}
      <div className="success-actions">
        <Button fullWidth size="lg" onClick={onClose}>FINALIZAR</Button>
        <Button fullWidth size="lg" variant="outline" onClick={() => { setStep(1); resetFields(); }}>
          <Plus size={20} /> Hacer nuevo reporte
        </Button>
      </div>
    </div>
  );
};
