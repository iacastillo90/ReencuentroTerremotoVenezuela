import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { addPendingReport } from '../../db/offlineDb';
import { registerBackgroundSync } from '../../utils/sync-utils';

export interface ReportContextType {
  step: number; setStep: (s: number | ((prev: number) => number)) => void;
  isSubmitting: boolean; error: string; setError: (v: string) => void; isOfflineSaved: boolean;
  audioText: string; setAudioText: (v: string) => void;
  nombreCompleto: string; setNombreCompleto: (v: string) => void;
  edad: string; setEdad: (v: string) => void;
  categoria: string; setCategoria: (v: string) => void;
  genero: string; setGenero: (v: string) => void;
  complexion: string; setComplexion: (v: string) => void;
  piel: string; setPiel: (v: string) => void;
  cabello: string; setCabello: (v: string) => void;
  ojos: string; setOjos: (v: string) => void;
  prendaSup: string; setPrendaSup: (v: string) => void;
  colorSup: string; setColorSup: (v: string) => void;
  prendaInf: string; setPrendaInf: (v: string) => void;
  colorInf: string; setColorInf: (v: string) => void;
  sinVestimenta: boolean; setSinVestimenta: (v: boolean) => void;
  senasSelected: string[]; detalleAdicional: string; setDetalleAdicional: (v: string) => void;
  file: File | null; calleEstado: string; setCalleEstado: (v: string) => void;
  reporterLocation: { lat: number; lng: number } | null;
  locationSuccess: boolean; isRequestingLocation: boolean;
  submitReport: () => Promise<void>; requestLocation: () => void;
  toggleSena: (val: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetFields: () => void; onClose: () => void;
}

const ReportCtx = createContext<ReportContextType | null>(null);

export function ReportProvider({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
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
  const [reporterLocation, setReporterLocation] = useState<{lat: number; lng: number} | null>(null);

  const resetFields = useCallback(() => {
    setAudioText(''); setNombreCompleto(''); setEdad('');
    setCategoria(''); setGenero(''); setComplexion('');
    setPiel(''); setCabello(''); setOjos('');
    setPrendaSup(''); setColorSup(''); setPrendaInf(''); setColorInf('');
    setSinVestimenta(false); setSenasSelected([]); setDetalleAdicional('');
    setFile(null); setReporterLocation(null); setLocationSuccess(false);
    setCalleEstado(''); setIsOfflineSaved(false);
  }, []);

  const toggleSena = useCallback((val: string) => {
    setSenasSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]);
  }, []);

  const requestLocation = useCallback(() => {
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
  }, []);

  const submitReport = useCallback(async () => {
    if (!calleEstado || calleEstado.trim().length < 2) {
      setError('Por favor indica la calle y estado (mínimo 2 caracteres). Puedes usar el botón de geolocalización.');
      return;
    }
    setIsSubmitting(true); setError('');
    try {
      const payloadText = `[REPORTE ${audioText === '' ? 'MANUAL' : 'ASISTIDO IA'}]
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
      const payload: Record<string, unknown> = {
        source: 'manual', externalId: `reporte_${Date.now()}`,
        type: categoria === 'mascota' ? 'animal' : 'person',
        name: nombreCompleto || (audioText ? 'Reporte Anónimo (Asistente)' : 'Reporte Manual'),
        estado: calleEstado, text: payloadText, date: new Date().toISOString(),
        isMinor: categoria === 'niño/a o adolescente', reporterLocation,
      };
      if (!navigator.onLine) {
        const csrfCookie = document.cookie.split('; ').find((r) => r.startsWith('csrf-token='));
        const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : undefined;
        await addPendingReport(payload, file || undefined, csrfToken);
        await registerBackgroundSync();
        setIsOfflineSaved(true); setStep(7); return;
      }
      if (file) {
        const fd = new FormData(); fd.append('file', file);
        const uploadRes = await api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.photoUrl = uploadRes.data.url;
      }
      await api.post('/persons', payload);
      setStep(7);
    } catch (err: unknown) {
      console.error(err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Error al enviar reporte.');
    } finally { setIsSubmitting(false); }
  }, [calleEstado, audioText, nombreCompleto, edad, categoria, genero, complexion, piel, cabello, ojos, prendaSup, colorSup, prendaInf, colorInf, sinVestimenta, senasSelected, detalleAdicional, file, reporterLocation]);

  const autoFillFromText = useCallback((text: string) => {
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
  }, []);

  useEffect(() => { if (audioText) autoFillFromText(audioText); }, [audioText, autoFillFromText]);

  const value: ReportContextType = {
    step, setStep, isSubmitting, error, setError, isOfflineSaved,
    audioText, setAudioText, nombreCompleto, setNombreCompleto, edad, setEdad,
    categoria, setCategoria, genero, setGenero, complexion, setComplexion,
    piel, setPiel, cabello, setCabello, ojos, setOjos,
    prendaSup, setPrendaSup, colorSup, setColorSup, prendaInf, setPrendaInf,
    colorInf, setColorInf, sinVestimenta, setSinVestimenta,
    senasSelected, detalleAdicional, setDetalleAdicional,
    file, calleEstado, setCalleEstado, reporterLocation, locationSuccess,
    isRequestingLocation, submitReport, requestLocation, toggleSena,
    handleFileChange, resetFields, onClose,
  };

  return <ReportCtx.Provider value={value}>{children}</ReportCtx.Provider>;
}

export function useReport(): ReportContextType {
  const ctx = useContext(ReportCtx);
  if (!ctx) throw new Error('useReport must be used within ReportProvider');
  return ctx;
}
