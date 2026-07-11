/**
 * components/modals/ReportSteps.tsx — Pasos individuales del formulario de reporte
 *
 * PROPÓSITO:
 *   Define los 7 componentes de paso que componen el flujo de ReportModal.
 *   Cada paso es un componente puro (solo recibe props, no tiene estado propio)
 *   para mantener la lógica de formulario centralizada en ReportModal.
 *
 * CONSTANTES:
 *   Las listas de colores y señas están en reportFormConstants.ts
 *   (separadas para compatibilidad con Fast Refresh de Vite).
 *
 * ESTADO COMPARTIDO (ReportState + ReportActions):
 *   Tipos exportados para que ReportModal pueda pasarlos como props.
 *   ReportState = todos los campos del formulario.
 *   ReportActions = todas las funciones que modifican el estado.
 *
 * FLUJO DE CADA PASO:
 *   1. StepCategory   → selector de categoría (adulto, niño, etc.)
 *   2. StepVoice      → asistente IA de voz + textarea de descripción
 *   3. StepCharacteristics → género + nombre + edad + complexión + colores
 *   4. StepClothing   → prenda superior e inferior + checkbox "sin info"
 *   5. StepFeatures   → señas particulares (toggle) + detalle adicional
 *   6. StepLocation   → ubicación + foto + botón de envío
 *   7. StepSuccess    → confirmación online u offline
 *
 * NOTA SOBRE LA PRIVACIDAD:
 *   StepLocation muestra una advertencia LOPNNA si la categoría es
 *   'niño/a o adolescente' y bloquea la subida de fotos.
 */
import React from 'react';
import { CheckCircle, Info, Loader2, MapPin, Plus, ShieldAlert, Sparkles, Video, WifiOff } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import { CustomSelect, CategorySelector, DEFAULT_CATEGORIES } from '../common';
import { COLORS_PIEL, COLORS_CABELLO, COLORS_OJOS, COMPLEXION, SENAS } from './reportFormConstants';

/* ─── TIPOS COMPARTIDOS ─── */

export interface ReportState {
  categoria: string;
  audioText: string;
  nombreCompleto: string;
  edad: string;
  genero: string;
  complexion: string;
  piel: string;
  cabello: string;
  ojos: string;
  prendaSup: string;
  colorSup: string;
  prendaInf: string;
  colorInf: string;
  sinVestimenta: boolean;
  senasSelected: string[];
  detalleAdicional: string;
  file: File | null;
  calleEstado: string;
  reporterLocation: { lat: number; lng: number } | null;
  locationSuccess: boolean;
  isRequestingLocation: boolean;
  isSubmitting: boolean;
  error: string;
  isOfflineSaved: boolean;
}

export interface ReportActions {
  setStep: (s: number) => void;
  onClose: () => void;
  resetFields: () => void;
  submitReport: () => void;
  requestLocation: () => void;
  toggleSena: (val: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/* ─── PASO 1: SELECCIÓN DE CATEGORÍA ─── */

export const StepCategory: React.FC<{
  state: ReportState;
  actions: { setCategoria: (v: string) => void; setStep: (s: number) => void };
}> = ({ state, actions }) => (
  <div className="report-step-content">
    <CategorySelector categories={DEFAULT_CATEGORIES} selected={state.categoria} onSelect={actions.setCategoria} />
    <button type="button" onClick={() => actions.setStep(2)} className="btn-ai-assist">
      <Sparkles size={20} /> Reportar con Asistente IA
    </button>
    <div className="sticky-bottom-action">
      <div className="report-footer-privacy">
        <Info size={14} />
        <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
      </div>
      <div className="step-submit-row">
        <Button fullWidth size="lg" onClick={() => actions.setStep(3)} disabled={!state.categoria}>SIGUIENTE</Button>
      </div>
    </div>
  </div>
);

/* ─── PASO 2: ASISTENTE DE VOZ / DESCRIPCIÓN ─── */

export const StepVoice: React.FC<{
  state: ReportState;
  actions: { setAudioText: (v: string) => void; setStep: (s: number) => void; resetFields: () => void };
}> = ({ state, actions }) => (
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
      currentText={state.audioText}
      onStartRecording={actions.resetFields}
      onTranscription={(txt) => actions.setAudioText(txt)}
    />
    <div className="figma-input-field">
      <label>DESCRIPCIÓN (o transcribe con el asistente de voz)</label>
      <textarea
        value={state.audioText}
        onChange={(e) => actions.setAudioText(e.target.value)}
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
        <Button variant="outline" size="lg" onClick={() => actions.setStep(1)}>ATRÁS</Button>
        <Button fullWidth size="lg" onClick={() => actions.setStep(3)}>SIGUIENTE</Button>
      </div>
    </div>
  </div>
);

/* ─── PASO 3: CARACTERÍSTICAS FÍSICAS ─── */

export const StepCharacteristics: React.FC<{
  state: ReportState;
  actions: {
    setGenero: (v: string) => void;
    setNombreCompleto: (v: string) => void;
    setEdad: (v: string) => void;
    setComplexion: (v: string) => void;
    setPiel: (v: string) => void;
    setCabello: (v: string) => void;
    setOjos: (v: string) => void;
    setStep: (s: number) => void;
  };
}> = ({ state, actions }) => (
  <div className="report-step-content">
    <div className="figma-section">
      <label className="figma-section-label">Género</label>
      <div className="figma-card-group">
        {['Masculino', 'Femenino'].map((g) => (
          <button key={g} type="button" onClick={() => actions.setGenero(g)}
            className={`figma-card-gender ${state.genero === g ? 'selected' : ''}`}>{g}</button>
        ))}
      </div>
    </div>
    <div className="figma-input-field">
      <label>NOMBRE (Opcional)</label>
      <input type="text" value={state.nombreCompleto} onChange={(e) => actions.setNombreCompleto(e.target.value)}
        placeholder="¿Conoces el nombre de esta persona?" />
    </div>
    <div className="figma-input-field">
      <label>EDAD APROXIMADA (Opcional)</label>
      <input type="number" value={state.edad} onChange={(e) => actions.setEdad(e.target.value)} placeholder="Ej. 25" />
    </div>
    <div className="figma-section">
      <label className="figma-section-label">Complexión</label>
      <div className="figma-card-group">
        {COMPLEXION.map((c) => (
          <button key={c.val} type="button" onClick={() => actions.setComplexion(c.val)}
            className={`figma-card ${state.complexion === c.val ? 'selected' : ''}`}>
            <strong>{c.title}</strong>
            <span>{c.desc}</span>
          </button>
        ))}
      </div>
    </div>
    <CustomSelect label="Color de piel" options={COLORS_PIEL} value={state.piel} onChange={actions.setPiel} placeholder="Seleccionar color" />
    <CustomSelect label="Color de cabello" options={COLORS_CABELLO} value={state.cabello} onChange={actions.setCabello} placeholder="Seleccionar color" />
    <CustomSelect label="Color de ojos" options={COLORS_OJOS} value={state.ojos} onChange={actions.setOjos} placeholder="Seleccionar color" />
    <div className="report-footer-privacy">
      <Info size={14} />
      <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
    </div>
    <div className="step-submit-row">
      <Button fullWidth size="lg" onClick={() => actions.setStep(4)}>ACEPTAR</Button>
    </div>
  </div>
);

/* ─── PASO 4: VESTIMENTA ─── */

export const StepClothing: React.FC<{
  state: ReportState;
  actions: {
    setPrendaSup: (v: string) => void;
    setColorSup: (v: string) => void;
    setPrendaInf: (v: string) => void;
    setColorInf: (v: string) => void;
    setSinVestimenta: (v: boolean) => void;
    setStep: (s: number) => void;
  };
}> = ({ state, actions }) => (
  <div className="report-step-content">
    <div className={state.sinVestimenta ? 'figma-muted-group' : ''}>
      <div className="figma-input-field">
        <label>PRENDA SUPERIOR</label>
        <input type="text" list="prenda-sup-opts" value={state.prendaSup}
          onChange={(e) => actions.setPrendaSup(e.target.value)} placeholder="Ej: Camisa, sueter..." />
        <datalist id="prenda-sup-opts">
          <option value="Camisa"/><option value="Sueter"/><option value="Sin camisa"/>
          <option value="Franela"/><option value="Camisa sin manga"/>
        </datalist>
      </div>
      <div className="figma-input-field">
        <label>COLOR PRENDA SUPERIOR</label>
        <input type="text" value={state.colorSup} onChange={(e) => actions.setColorSup(e.target.value)}
          placeholder="Ej: Rojo, Azul marino..." />
      </div>
      <div className="figma-input-field">
        <label>PRENDA INFERIOR</label>
        <input type="text" list="prenda-inf-opts" value={state.prendaInf}
          onChange={(e) => actions.setPrendaInf(e.target.value)} placeholder="Ej: Pantalón, short..." />
        <datalist id="prenda-inf-opts">
          <option value="Pantalon"/><option value="Short"/><option value="Jean"/>
          <option value="Mono"/><option value="Licra"/><option value="Falda"/>
        </datalist>
      </div>
      <div className="figma-input-field">
        <label>COLOR PRENDA INFERIOR</label>
        <input type="text" value={state.colorInf} onChange={(e) => actions.setColorInf(e.target.value)}
          placeholder="Ej: Negro, Azul claro..." />
      </div>
    </div>
    <label className="figma-checkbox-row">
      <input type="checkbox" checked={state.sinVestimenta}
        onChange={(e) => actions.setSinVestimenta(e.target.checked)} />
      <span>No tengo información de esto</span>
    </label>
    <div className="step-submit-row">
      <Button fullWidth size="lg" onClick={() => actions.setStep(5)}>ACEPTAR</Button>
    </div>
  </div>
);

/* ─── PASO 5: SEÑAS PARTICULARES ─── */

export const StepFeatures: React.FC<{
  state: ReportState;
  actions: { toggleSena: (v: string) => void; setDetalleAdicional: (v: string) => void; setStep: (s: number) => void };
}> = ({ state, actions }) => (
  <div className="report-step-content">
    <div className="figma-feature-btn-group">
      {SENAS.map((s) => {
        const active = state.senasSelected.includes(s.val);
        return (
          <button key={s.val} type="button" onClick={() => actions.toggleSena(s.val)}
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
      <textarea rows={3} value={state.detalleAdicional}
        onChange={(e) => actions.setDetalleAdicional(e.target.value)}
        placeholder="Ej. Cicatriz en antebrazo derecho, llevaba un bolso negro..." />
    </div>
    <div className="step-submit-row">
      <Button fullWidth size="lg" onClick={() => actions.setStep(6)}>ACEPTAR</Button>
    </div>
  </div>
);

/* ─── PASO 6: UBICACIÓN Y ENVÍO ─── */

export const StepLocation: React.FC<{
  state: ReportState;
  actions: {
    setCalleEstado: (v: string) => void;
    setStep: (s: number) => void;
    submitReport: () => void;
    requestLocation: () => void;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
}> = ({ state, actions }) => (
  <div className="report-step-content">
    {state.categoria === 'niño/a o adolescente' ? (
      /* Advertencia LOPNNA: no se permiten fotos de menores */
      <div className="figma-alert-danger">
        <ShieldAlert size={36} color="#ef4444" className="centered-icon" />
        <strong>Protección al Menor (LOPNNA)</strong>
        <p>Por ley, no está permitido adjuntar fotografías o videos de menores de edad.
          Su reporte será enviado directamente a las autoridades correspondientes para un manejo confidencial.</p>
      </div>
    ) : (
      <label className="figma-upload-area">
        <input type="file" accept="image/*,video/mp4" onChange={actions.handleFileChange} />
        <Video size={48} color="#94a3b8" className="centered-icon" />
        <strong>Subir Evidencia (Foto o Video)</strong>
        <span>{state.file ? state.file.name : 'Toca para abrir la cámara o galería'}</span>
      </label>
    )}
    <button type="button" onClick={actions.requestLocation}
      disabled={state.isRequestingLocation || state.locationSuccess}
      className={`figma-location-btn ${state.locationSuccess ? 'success' : ''}`}>
      {state.isRequestingLocation ? <Loader2 className="spinner" size={20} /> : <MapPin size={20} />}
      {state.locationSuccess ? 'Ubicación Adjuntada' : 'Añadir mi Ubicación actual'}
    </button>
    <div className="figma-input-field">
      <label>CALLE Y ESTADO (Opcional)</label>
      <input type="text" value={state.calleEstado} onChange={(e) => actions.setCalleEstado(e.target.value)}
        placeholder="Calle y estado..." />
    </div>
    {state.reporterLocation && (
      <div className="location-card">
        <div className="location-card-icon">
          <MapPin size={24} color="#34d399" />
        </div>
        <div className="location-card-body">
          <span className="location-card-title">Ubicación adjunta</span>
          <span className="location-card-meta">Lat: {state.reporterLocation.lat.toFixed(4)} | Lng: {state.reporterLocation.lng.toFixed(4)}</span>
          <span className="location-card-meta">IP: Obtenida por el sistema</span>
        </div>
        <CheckCircle size={20} color="#34d399" className="location-card-check" />
      </div>
    )}
    <div className="step-submit-row">
      <Button fullWidth size="lg" onClick={actions.submitReport} disabled={state.isSubmitting}>
        {state.isSubmitting ? <Loader2 className="spinner" size={20} /> : 'SUBIR'}
      </Button>
    </div>
  </div>
);

/* ─── PASO 7: ÉXITO / CONFIRMACIÓN ─── */

export const StepSuccess: React.FC<{
  state: Pick<ReportState, 'isOfflineSaved'>;
  actions: { onClose: () => void; setStep: (s: number) => void; resetFields: () => void };
}> = ({ state, actions }) => (
  <div className="report-step-content-centered">
    {state.isOfflineSaved ? (
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
      <Button fullWidth size="lg" onClick={actions.onClose}>FINALIZAR</Button>
      <Button fullWidth size="lg" variant="outline" onClick={() => { actions.setStep(1); actions.resetFields(); }}>
        <Plus size={20} /> Hacer nuevo reporte
      </Button>
    </div>
  </div>
);
