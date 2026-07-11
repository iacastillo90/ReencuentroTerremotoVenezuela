/**
 * components/modals/ReportModal.tsx — Modal multi-paso para reportar personas
 *
 * PROPÓSITO:
 *   Guía al usuario a través de 7 pasos para reportar una persona desaparecida
 *   (o mascota). Cada paso captura un aspecto diferente de la información.
 *
 * FLUJO DE PANTALLAS:
 *   1. StepCategory   → Seleccionar tipo (adulto, niño, mascota...)
 *   2. StepVoice      → Grabar/describir con asistente IA de voz
 *   3. StepCharacteristics → Género, nombre, edad, complexión, color piel/cabello/ojos
 *   4. StepClothing   → Vestimenta superior e inferior
 *   5. StepFeatures   → Señas particulares (cicatrices, tatuajes, etc.)
 *   6. StepLocation   → Ubicación + subir foto → ENVÍO
 *   7. StepSuccess    → Confirmación
 *
 * AUTO-LLENADO POR IA (autoFillFromText):
 *   Cuando el usuario usa el asistente de voz, la transcripción se analiza
 *   con expresiones regulares en español para detectar automáticamente:
 *   - Edad → categoría (niño/adulto/mayor)
 *   - Género masculino/femenino
 *   - Complexión, color de piel, cabello, ojos
 *   - Prendas de vestir y sus colores
 *   - Señas particulares (cicatrices, tatuajes, lentes, etc.)
 *
 *   Esto ahorra tiempo: el usuario solo confirma lo que la IA ya adivinó.
 *
 * MODO OFFLINE:
 *   Si navigator.onLine es false, el reporte se guarda en IndexedDB
 *   (offlineDb.ts) con estado 'draft_offline'. Se sincronizará cuando
 *   el dispositivo recupere conexión (ver useBackgroundSync).
 *
 * ERRORES:
 *   - Se muestran en un overlay con diseño de "tarjeta de error" (ShieldAlert).
 *   - El usuario nunca pierde los datos del paso actual al cerrar el error.
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, X, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { db } from '../../db/offlineDb';
import { Button } from '../ui/Button';
import { BrandMark } from '../BrandMark';
import {
  StepCategory, StepVoice, StepCharacteristics, StepClothing,
  StepFeatures, StepLocation, StepSuccess,
} from './ReportSteps';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  onGoDirectory?: () => void;
  onNavigate?: (view: any) => void;
  defaultType?: 'person' | 'animal';
}

export const ReportModal: React.FC<ReportModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // ─── Estado del formulario (compartido entre pasos) ───
  const [audioText, setAudioText] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [edad, setEdad] = useState('');

  const [categoria, setCategoria] = useState('');
  const [genero, setGenero] = useState('');
  const [complexion, setComplexion] = useState('');
  const [piel, setPiel] = useState('');
  const [cabello, setCabello] = useState('');
  const [ojos, setOjos] = useState('');

  const [prendaSup, setPrendaSup] = useState('');
  const [colorSup, setColorSup] = useState('');
  const [prendaInf, setPrendaInf] = useState('');
  const [colorInf, setColorInf] = useState('');
  const [sinVestimenta, setSinVestimenta] = useState(false);

  const [senasSelected, setSenasSelected] = useState<string[]>([]);
  const [detalleAdicional, setDetalleAdicional] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [calleEstado, setCalleEstado] = useState('');
  const [reporterLocation, setReporterLocation] = useState<{lat: number, lng: number} | null>(null);

  /* ─── Limpiar todos los campos (para "hacer nuevo reporte") ─── */
  const resetFields = () => {
    setAudioText(''); setNombreCompleto(''); setEdad('');
    setCategoria(''); setGenero(''); setComplexion('');
    setPiel(''); setCabello(''); setOjos('');
    setPrendaSup(''); setColorSup(''); setPrendaInf(''); setColorInf('');
    setSinVestimenta(false); setSenasSelected([]); setDetalleAdicional('');
    setFile(null); setReporterLocation(null); setLocationSuccess(false);
    setCalleEstado(''); setIsOfflineSaved(false);
  };

  /* ─── Toggle para selección múltiple de señas ─── */
  const toggleSena = (val: string) => {
    setSenasSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  /* ─── Manejar archivo adjunto (foto/video) ─── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]);
  };

  /* ─── Geolocalización del reportero ─── */
  // Usa la API de geolocalización del navegador + Nominatim (OpenStreetMap)
  // para obtener dirección legible. No almacenamos coordenadas exactas
  // a menos que el usuario confirme.
  const requestLocation = () => {
    if (!navigator.geolocation) { setError('Geolocalización no soportada.'); return; }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setReporterLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationSuccess(true); setIsRequestingLocation(false);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          if (data?.address) setCalleEstado(
            `${data.address.road || ''}, ${data.address.state || data.address.city || ''}`.trim().replace(/^,/, '')
          );
        } catch (e) { console.error(e); }
      },
      () => { setIsRequestingLocation(false); setError('No se pudo obtener la ubicación.'); }
    );
  };

  /* ─── Envío del reporte (online → API, offline → IndexedDB) ─── */
  const submitReport = async () => {
    if (!calleEstado || calleEstado.trim().length < 2) {
      setError('Por favor indica la calle y estado (mínimo 2 caracteres). Puedes usar el botón de geolocalización.');
      return;
    }
    setIsSubmitting(true); setError('');
    try {
      const payloadText = `[REPORTE ${step === 0 || audioText === '' ? 'MANUAL' : 'ASISTIDO IA'}]
Nombre: ${nombreCompleto || 'Desconocido'}
Edad Aproximada: ${edad || 'No especificada'}
Descripción / Audio: ${audioText}
Categoría: ${categoria}
Género: ${genero}
Complexión: ${complexion}
Piel: ${piel}, Cabello: ${cabello}, Ojos: ${ojos}
Vestimenta: ${sinVestimenta ? 'Sin info' : `Sup: ${prendaSup} (${colorSup}), Inf: ${prendaInf} (${colorInf})`}
Señas Particulares: ${senasSelected.join(', ')}
Detalles Adicionales: ${detalleAdicional}
Ubicación: ${calleEstado}`;
      const payload: any = {
        source: 'manual', externalId: `reporte_${Date.now()}`,
        type: categoria === 'mascota' ? 'animal' : 'person',
        name: nombreCompleto || (audioText ? 'Reporte Anónimo (Asistente)' : 'Reporte Manual'),
        estado: calleEstado, text: payloadText, date: new Date().toISOString(),
        isMinor: categoria === 'niño/a o adolescente', reporterLocation,
      };
      // Offline: guardar en IndexedDB para sincronizar después
      if (!navigator.onLine) {
        await db.offlineReports.add({
          reportData: payload, photoFile: file || undefined,
          status: 'draft_offline', createdAt: Date.now()
        });
        setIsOfflineSaved(true); setStep(7); return;
      }
      // Online: subir foto primero, luego enviar reporte
      if (file) {
        const fd = new FormData(); fd.append('file', file);
        const uploadRes = await api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.photoUrl = uploadRes.data.url;
      }
      await api.post('/persons', payload);
      setStep(7);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al enviar reporte.');
    } finally { setIsSubmitting(false); }
  };

  /* ─── Auto-llenado por IA desde transcripción de voz ─── */
  // Analiza el texto con regex para inferir categoría, género,
  // características físicas, vestimenta y señas particulares.
  const autoFillFromText = (text: string) => {
    const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let age = -1;
    const ageMatch = t.match(/(\d+)\s*(ano|año)/);
    if (ageMatch) age = parseInt(ageMatch[1], 10);
    if (age !== -1) {
      if (age < 18) setCategoria('niño/a o adolescente');
      else if (age >= 65) setCategoria('adulto mayor');
      else setCategoria('adulto');
    } else {
      if (/(nin[oa]|chiquit[oa]|bebe|adolescente)/.test(t)) setCategoria('niño/a o adolescente');
      else if (/(adulto mayor|ancian[oa]|abuel[oa]|viejit[oa])/.test(t)) setCategoria('adulto mayor');
      else if (/(perro|gato|mascota|cachorro)/.test(t)) setCategoria('mascota');
      else if (/(adult[oa]|hombre|mujer|senor|senora|muchach[oa])/.test(t)) setCategoria('adulto');
    }
    if (/(nino|hombre|senor|muchacho|abuelo)/.test(t)) setGenero('Masculino');
    else if (/(nina|mujer|senora|muchacha|abuela)/.test(t)) setGenero('Femenino');
    if (/(delgad[oa]|flac[oa]|delgadez)/.test(t)) setComplexion('delgada');
    else if (/(robust[oa]|gord[oa]|fuerte|grande)/.test(t)) setComplexion('robusta');
    else if (/(medi[oa]|normal|promedio)/.test(t)) setComplexion('media');
    if (/(piel clara|tez clara|blanc[oa])/.test(t)) setPiel('clara');
    else if (/(piel morena|tez morena|moren[oa]|triguen[oa])/.test(t)) setPiel('morena');
    else if (/(piel oscura|tez oscura|piel negra)/.test(t)) setPiel('oscura');
    if (/(cabello.{0,15}rubi[oa]|pelo.{0,15}rubi[oa]|catir[ea]|rubi[oa])/.test(t)) setCabello('rubio');
    else if (/(cabello.{0,15}canos[oa]|pelo.{0,15}canos[oa]|canas|pelo.{0,15}gris)/.test(t)) setCabello('canoso');
    else if (/(cabello.{0,15}pelirroj[oa]|pelo.{0,15}pelirroj[oa]|pelirroj[oa])/.test(t)) setCabello('pelirrojo');
    else if (/(calv[oa]|sin cabello|rapad[oa])/.test(t)) setCabello('sin cabello');
    else if (/(cabello.{0,15}castan[oa]|pelo.{0,15}castan[oa]|cabello.{0,15}marron|pelo.{0,15}marron)/.test(t)) setCabello('castaño');
    else if (/(cabello.{0,15}negr[oa]|pelo.{0,15}negr[oa])/.test(t)) setCabello('negro');
    if (/(ojos.{0,15}marron|ojos.{0,15}cafe)/.test(t)) setOjos('marrones');
    else if (/(ojos.{0,15}verde)/.test(t)) setOjos('verde');
    else if (/(ojos.{0,15}azul)/.test(t)) setOjos('azul');
    else if (/(ojos.{0,15}negro)/.test(t)) setOjos('negro');
    const supMatch = t.match(/(camisa|franela|sueter|chaqueta|abrigo)/);
    if (supMatch) {
      setPrendaSup(supMatch[0].charAt(0).toUpperCase() + supMatch[0].slice(1));
      const c = t.substring(supMatch.index || 0, (supMatch.index || 0) + 30).match(/(rojo|azul|verde|amarillo|negro|blanco|gris|naranja|rosado|morado)/);
      if (c) setColorSup(c[0].charAt(0).toUpperCase() + c[0].slice(1));
    }
    const infMatch = t.match(/(pantalon|short|jean|mono|falda|licra)/);
    if (infMatch) {
      setPrendaInf(infMatch[0].charAt(0).toUpperCase() + infMatch[0].slice(1));
      const c = t.substring(infMatch.index || 0, (infMatch.index || 0) + 30).match(/(rojo|azul|verde|amarillo|negro|blanco|gris|naranja|rosado|morado)/);
      if (c) setColorInf(c[0].charAt(0).toUpperCase() + c[0].slice(1));
    }
    const foundSenas: string[] = [];
    if (/(cicatriz|cicatrices|cortada|herida)/.test(t)) foundSenas.push('cicatrices');
    if (/(marca de nacimiento|mancha)/.test(t)) foundSenas.push('marca_nacimiento');
    if (/(barba|bigote|chiva|patillas|vello facial)/.test(t)) foundSenas.push('vello_facial');
    if (/(amputad[oa]|le falta.*(brazo|pierna|dedo|mano)|moch[oa]|sin.*(brazo|pierna|mano))/.test(t)) foundSenas.push('amputaciones');
    if (/(lente|anteojo|gafa|espejuelo)/.test(t)) foundSenas.push('lentes');
    if (/(tatuaje|tatuado|tattoo)/.test(t)) foundSenas.push('tatuajes');
    if (/(lunar|lunares)/.test(t)) foundSenas.push('lunares');
    if (/(silla de ruedas|baston|muleta|ortopedic|yeso)/.test(t)) foundSenas.push('aparatos');
    if (foundSenas.length > 0) setSenasSelected(foundSenas);
    const extras: string[] = [];
    ['reloj','collar','anillo','arete','zarcillo','pulsera','piercing','gorra','sombrero','mochila','bolso','morral','cartera','zapatos','zapato','botas','tenis','cojera','embarazada'].forEach(kw => {
      if (t.includes(kw)) { const m = t.match(new RegExp(`\\b${kw}\\b\\s*\\w*\\s*\\w*`)); if (m) extras.push(m[0].trim()); }
    });
    if (extras.length > 0) setDetalleAdicional(extras.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', '));
  };

  // Auto-llenar cada vez que cambia la transcripción
  useEffect(() => { if (audioText) autoFillFromText(audioText); }, [audioText]);

  /* ─── Mapa de pasos a componentes ─── */
  const state = {
    categoria, audioText, nombreCompleto, edad, genero, complexion,
    piel, cabello, ojos, prendaSup, colorSup, prendaInf, colorInf,
    sinVestimenta, senasSelected, detalleAdicional, file, calleEstado,
    reporterLocation, locationSuccess, isRequestingLocation, isSubmitting, error, isOfflineSaved,
  };

  const stepActions = { setStep, onClose, resetFields, submitReport, requestLocation, toggleSena, handleFileChange };

  const renderStep = () => {
    switch (step) {
      case 1: return <StepCategory state={state} actions={{ setCategoria, setStep: stepActions.setStep }} />;
      case 2: return <StepVoice state={state} actions={{ setAudioText, setStep: stepActions.setStep, resetFields: stepActions.resetFields }} />;
      case 3: return <StepCharacteristics state={state} actions={{ setGenero, setNombreCompleto, setEdad, setComplexion, setPiel, setCabello, setOjos, setStep: stepActions.setStep }} />;
      case 4: return <StepClothing state={state} actions={{ setPrendaSup, setColorSup, setPrendaInf, setColorInf, setSinVestimenta, setStep: stepActions.setStep }} />;
      case 5: return <StepFeatures state={state} actions={{ toggleSena: stepActions.toggleSena, setDetalleAdicional, setStep: stepActions.setStep }} />;
      case 6: return <StepLocation state={state} actions={{ setCalleEstado, submitReport: stepActions.submitReport, requestLocation: stepActions.requestLocation, handleFileChange: stepActions.handleFileChange, setStep: stepActions.setStep }} />;
      case 7: return <StepSuccess state={state} actions={stepActions} />;
      default: return null;
    }
  };

  // Metadatos del paso actual (título, progreso)
  const stepInfo = step < 7 ? {
    1: { dot: 1, paso: 'Paso 1', title: '¿Qué categoría quieres reportar?' },
    2: { dot: 1, paso: 'Paso 1', title: 'Descripción de la persona' },
    3: { dot: 2, paso: 'Paso 2', title: 'Características' },
    4: { dot: 3, paso: 'Paso 3', title: 'Vestimenta' },
    5: { dot: 4, paso: 'Paso 4', title: 'Señas particulares' },
    6: { dot: 5, paso: 'Paso 5', title: 'Ubicación y envío' },
  }[step] : null;

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
          <button onClick={onClose} className="header-close-btn"><X size={18} /></button>
        </header>

        {/* Barra de progreso + título del paso */}
        {step < 7 && (
          <>
            <div className="step-progress">
              {[1, 2, 3, 4, 5].map(d => (
                <div key={d} className={`step-dot ${stepInfo && d <= stepInfo.dot ? 'active' : ''}`} />
              ))}
            </div>
            <div className="step-header">
              <div className="step-paso">{stepInfo?.paso}</div>
              <div className="step-title">{stepInfo?.title}</div>
            </div>
            {step === 1 && (
              <div className="report-notification">
                <WifiOff className="notif-icon" size={20} />
                <div className="notif-content">
                  <div className="notif-title">Información importante</div>
                  <div className="notif-text">El reporte lo puedes hacer incluso si no tienes señal.</div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="report-modal-body">
          <div key={step} className="step-animated-container">{renderStep()}</div>
        </div>
      </div>

      {/* Overlay de error con diseño de tarjeta */}
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
