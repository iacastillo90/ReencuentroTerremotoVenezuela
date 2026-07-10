import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Loader2, MapPin, ShieldAlert, Sparkles, Video, Plus, X, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { db } from '../../db/offlineDb';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  onGoDirectory?: () => void;
  onNavigate?: (view: any) => void;
  defaultType?: 'person' | 'animal';
}

const COLORS_PIEL = [
  { val: 'clara', hex: '#fadcbc', label: 'Clara' },
  { val: 'media', hex: '#d2996c', label: 'Media' },
  { val: 'morena', hex: '#8d5524', label: 'Morena' },
  { val: 'oscura', hex: '#3d2314', label: 'Oscura' }
];

const COLORS_CABELLO = [
  { val: 'negro', hex: '#000000', label: 'Negro' },
  { val: 'castaño', hex: '#5c3a21', label: 'Castaño' },
  { val: 'rubio', hex: '#d6b85a', label: 'Rubio' },
  { val: 'canoso', hex: '#d9d9d9', label: 'Canoso' },
  { val: 'pelirrojo', hex: '#ad3e17', label: 'Pelirrojo' },
  { val: 'sin cabello', hex: '#e8c39e', label: 'Sin cabello' }
];

const COLORS_OJOS = [
  { val: 'marrones', hex: '#5c3a21', label: 'Marrones' },
  { val: 'negro', hex: '#000000', label: 'Negro' },
  { val: 'verde', hex: '#5b8a53', label: 'Verde' },
  { val: 'azul', hex: '#3b82f6', label: 'Azul' },
  { val: 'gris', hex: '#808080', label: 'Gris' }
];

const COMPLEXION = [
  { val: 'delgada', title: 'Delgada', desc: 'Persona delgada' },
  { val: 'media', title: 'Media', desc: 'Contextura promedio' },
  { val: 'robusta', title: 'Robusta', desc: 'Persona de contextura fuerte' }
];

const SENAS = [
  { val: 'cicatrices', label: 'Cicatrices', desc: 'Marca visible en la piel por herida o cirugía' },
  { val: 'marca_nacimiento', label: 'Marca de nacimiento', desc: 'Mancha o marca presente desde el nacimiento' },
  { val: 'vello_facial', label: 'Vello facial', desc: 'Barba, bigote o patillas' },
  { val: 'amputaciones', label: 'Amputaciones / ausencia de miembros', desc: 'Falta parcial o total de una extremidad' },
  { val: 'lentes', label: 'Lentes', desc: 'Usa anteojos de forma habitual' },
  { val: 'tatuajes', label: 'Tatuajes', desc: 'Diseño permanente en la piel' },
  { val: 'lunares', label: 'Lunares visibles', desc: 'Lunar de tamaño o ubicación notable' },
  { val: 'aparatos', label: 'Uso de aparatos ortopédicos visibles', desc: 'Bastón, silla de ruedas o aparato ortodóntico' },
];

const CustomSelect = ({ label, options, value, onChange, placeholder }: any) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o: any) => o.val === value);
  return (
    <div className="form-group" style={{ position: 'relative', marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>{label}</label>
      <div 
        onClick={() => setOpen(!open)}
        style={{ padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}
      >
        {selected ? (
          <>
            {selected.hex && <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: selected.hex, border: '1px solid rgba(255,255,255,0.2)' }} />}
            <span style={{ color: '#fff', fontWeight: 500 }}>{selected.label}</span>
          </>
        ) : <span style={{ color: '#64748b' }}>{placeholder}</span>}
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10, maxHeight: 220, overflowY: 'auto', borderRadius: '12px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
            {options.map((o: any) => (
              <div 
                key={o.val} 
                onClick={() => { onChange(o.val); setOpen(false); }}
                style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', background: value === o.val ? 'rgba(59,130,246,0.1)' : 'transparent' }}
              >
                {o.hex && <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: o.hex, border: '1px solid rgba(255,255,255,0.2)' }} />}
                <span style={{ color: '#fff', fontWeight: value === o.val ? 600 : 400 }}>{o.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ReportModal: React.FC<ReportModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(2); // Inicia directamente en el formulario manual
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Step 1 / General Description
  const [audioText, setAudioText] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  // Step 2
  const [categoria, setCategoria] = useState('');
  const [genero, setGenero] = useState('');
  const [complexion, setComplexion] = useState('');
  const [piel, setPiel] = useState('');
  const [cabello, setCabello] = useState('');
  const [ojos, setOjos] = useState('');

  // Step 3
  const [prendaSup, setPrendaSup] = useState('');
  const [colorSup, setColorSup] = useState('');
  const [prendaInf, setPrendaInf] = useState('');
  const [colorInf, setColorInf] = useState('');
  const [sinVestimenta, setSinVestimenta] = useState(false);

  // Step 4
  const [senasSelected, setSenasSelected] = useState<string[]>([]);
  const [detalleAdicional, setDetalleAdicional] = useState('');

  // Step 5
  const [file, setFile] = useState<File | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [calleEstado, setCalleEstado] = useState('');
  const [reporterLocation, setReporterLocation] = useState<{lat: number, lng: number} | null>(null);

  const resetFields = () => {
    setAudioText('');
    setCategoria('');
    setGenero('');
    setComplexion('');
    setPiel('');
    setCabello('');
    setOjos('');
    setPrendaSup('');
    setColorSup('');
    setPrendaInf('');
    setColorInf('');
    setSinVestimenta(false);
    setSenasSelected([]);
    setDetalleAdicional('');
    setFile(null);
    setReporterLocation(null);
    setLocationSuccess(false);
    setCalleEstado('');
    setIsOfflineSaved(false);
  };

  const toggleSena = (val: string) => {
    setSenasSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada.');
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setReporterLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationSuccess(true);
        setIsRequestingLocation(false);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          if (data && data.address) {
            setCalleEstado(`${data.address.road || ''}, ${data.address.state || data.address.city || ''}`.trim().replace(/^,/, ''));
          }
        } catch (e) {
          console.error(e);
        }
      },
      () => {
        setIsRequestingLocation(false);
        setError('No se pudo obtener la ubicación.');
      }
    );
  };

  const submitReport = async () => {
    if (!calleEstado || calleEstado.trim().length < 2) {
      setError('Por favor indica la calle y estado (mínimo 2 caracteres). Puedes usar el botón de geolocalización.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      let photoUrl = '';
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        photoUrl = uploadRes.data.url;
      }
      
      const payloadText = `[REPORTE ${step === 0 || audioText === '' ? 'MANUAL' : 'ASISTIDO IA'}]
Nombre: ${nombreCompleto || 'Desconocido'}
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
        source: 'manual',
        externalId: `reporte_${Date.now()}`,
        type: categoria === 'mascota' ? 'animal' : 'person',
        name: nombreCompleto || (audioText ? 'Reporte Anónimo (Asistente)' : 'Reporte Manual'),
        estado: calleEstado,
        text: payloadText,
        date: new Date().toISOString(),
        isMinor: categoria === 'niño/a o adolescente',
        reporterLocation
      };

      if (!navigator.onLine) {
        // Save to IndexedDB (Offline Draft)
        await db.offlineReports.add({
          reportData: payload,
          photoFile: file || undefined,
          status: 'draft_offline',
          createdAt: Date.now()
        });
        setIsOfflineSaved(true);
        setStep(6);
        return;
      }

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.photoUrl = uploadRes.data.url;
      }

      await api.post('/persons', payload);
      setStep(6);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al enviar reporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoFillFromText = (text: string) => {
    // Normalizar para quitar acentos y transformar la ñ en n
    const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Extracción de Edad para filtros inteligentes
    let age = -1;
    const ageMatch = t.match(/(\d+)\s*(ano|año)/);
    if (ageMatch) {
      age = parseInt(ageMatch[1], 10);
    }

    // Categoría y Género
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

    // Complexión
    if (/(delgad[oa]|flac[oa]|delgadez)/.test(t)) setComplexion('delgada');
    else if (/(robust[oa]|gord[oa]|fuerte|grande)/.test(t)) setComplexion('robusta');
    else if (/(medi[oa]|normal|promedio)/.test(t)) setComplexion('media');

    // Piel (requiere palabras precisas para evitar chocar con ojos o ropa)
    if (/(piel clara|tez clara|blanc[oa])/.test(t)) setPiel('clara');
    else if (/(piel morena|tez morena|moren[oa]|triguen[oa])/.test(t)) setPiel('morena');
    else if (/(piel oscura|tez oscura|piel negra)/.test(t)) setPiel('oscura');

    // Cabello
    if (/(cabello.{0,15}rubi[oa]|pelo.{0,15}rubi[oa]|catir[ea]|rubi[oa])/.test(t)) setCabello('rubio');
    else if (/(cabello.{0,15}canos[oa]|pelo.{0,15}canos[oa]|canas|pelo.{0,15}gris)/.test(t)) setCabello('canoso');
    else if (/(cabello.{0,15}pelirroj[oa]|pelo.{0,15}pelirroj[oa]|pelirroj[oa])/.test(t)) setCabello('pelirrojo');
    else if (/(calv[oa]|sin cabello|rapad[oa])/.test(t)) setCabello('sin cabello');
    else if (/(cabello.{0,15}castan[oa]|pelo.{0,15}castan[oa]|cabello.{0,15}marron|pelo.{0,15}marron)/.test(t)) setCabello('castaño');
    else if (/(cabello.{0,15}negr[oa]|pelo.{0,15}negr[oa])/.test(t)) setCabello('negro');

    // Ojos (Permite palabras intermedias como "color" ej: ojos color negro)
    if (/(ojos.{0,15}marron|ojos.{0,15}cafe)/.test(t)) setOjos('marrones');
    else if (/(ojos.{0,15}verde)/.test(t)) setOjos('verde');
    else if (/(ojos.{0,15}azul)/.test(t)) setOjos('azul');
    else if (/(ojos.{0,15}negro)/.test(t)) setOjos('negro');

    // Ropa superior (Busca color cercano a la prenda)
    const supMatch = t.match(/(camisa|franela|sueter|chaqueta|abrigo)/);
    if (supMatch) {
      setPrendaSup(supMatch[0].charAt(0).toUpperCase() + supMatch[0].slice(1));
      const colorMatch = t.substring(supMatch.index || 0, (supMatch.index || 0) + 30).match(/(rojo|azul|verde|amarillo|negro|blanco|gris|naranja|rosado|morado)/);
      if (colorMatch) setColorSup(colorMatch[0].charAt(0).toUpperCase() + colorMatch[0].slice(1));
    }

    // Ropa inferior
    const infMatch = t.match(/(pantalon|short|jean|mono|falda|licra)/);
    if (infMatch) {
      setPrendaInf(infMatch[0].charAt(0).toUpperCase() + infMatch[0].slice(1));
      const colorMatch = t.substring(infMatch.index || 0, (infMatch.index || 0) + 30).match(/(rojo|azul|verde|amarillo|negro|blanco|gris|naranja|rosado|morado)/);
      if (colorMatch) setColorInf(colorMatch[0].charAt(0).toUpperCase() + colorMatch[0].slice(1));
    }

    // Señas Particulares (Paso 4)
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

    // Detalles adicionales (Extracción de accesorios o contexto adicional)
    const extras: string[] = [];
    const extraKeywords = ['reloj', 'collar', 'anillo', 'arete', 'zarcillo', 'pulsera', 'piercing', 'gorra', 'sombrero', 'mochila', 'bolso', 'morral', 'cartera', 'zapatos', 'zapato', 'botas', 'tenis', 'cojera', 'embarazada'];
    
    extraKeywords.forEach(kw => {
      if (t.includes(kw)) {
        // Extrae la palabra clave y hasta 2 palabras siguientes para dar contexto (ej: "gorra negra", "zapatos deportivos")
        const regex = new RegExp(`\\b${kw}\\b\\s*\\w*\\s*\\w*`);
        const m = t.match(regex);
        if (m) extras.push(m[0].trim());
      }
    });

    if (extras.length > 0) {
      // Capitalizar la primera letra y unir con comas
      setDetalleAdicional(extras.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', '));
    }
  };

  useEffect(() => {
    if (audioText) {
      autoFillFromText(audioText);
    }
  }, [audioText]);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 800 }}>Descripción de la persona</h3>
            <div className="ai-notice" style={{ padding: '1rem', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '2rem', display: 'flex', gap: '12px' }}>
              <Sparkles size={24} color="#3b82f6" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#60a5fa', lineHeight: 1.4 }}>
                Usa el asistente de voz. Trata de mencionar detalles como si es niño/adulto, cómo está vestido y características físicas.
              </p>
            </div>
            <AudioRecorder 
              currentText={audioText}
              onStartRecording={resetFields}
              onTranscription={(txt) => {
                setAudioText(txt);
              }} 
            />
            <textarea 
              value={audioText}
              onChange={(e) => setAudioText(e.target.value)}
              placeholder="Ejemplo: Adulto de 55 años, con una cicatriz en la cara..."
              style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#374151', 
                borderRadius: '12px', 
                fontSize: '0.82rem', 
                lineHeight: '1.4',
                color: '#f8fafc', 
                border: '1px solid #4b5563',
                width: '100%',
                minHeight: '150px',
                resize: 'vertical'
              }}
            />
            <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', gap: '1rem' }}>
              <Button variant="outline" size="lg" onClick={() => setStep(2)}>ATRÁS</Button>
              <Button fullWidth size="lg" onClick={() => setStep(2)}>SIGUIENTE</Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 800 }}>Características Generales</h3>
            
            {audioText ? (
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                   <CheckCircle size={18} /> <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Audio registrado con éxito</span>
                </div>
                <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                  Editar Audio
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => setStep(1)}
                style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Sparkles size={20} /> Reportar con Asistente IA
              </button>
            )}
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>NOMBRE (Opcional)</label>
              <input type="text" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} placeholder="¿Conoces el nombre de esta persona?" style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff' }} />
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>CATEGORÍA Y GÉNERO</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              {['niño/a o adolescente', 'adulto', 'adulto mayor', 'mascota'].map(c => (
                <button key={c} type="button" onClick={() => setCategoria(c)} style={{ padding: '0.75rem', borderRadius: '12px', border: categoria === c ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', background: categoria === c ? 'rgba(59,130,246,0.1)' : 'transparent', color: '#fff', textTransform: 'capitalize', fontWeight: 500, fontSize: '0.9rem' }}>{c}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
              {['Masculino', 'Femenino'].map(g => (
                <button key={g} type="button" onClick={() => setGenero(g)} style={{ padding: '0.75rem', borderRadius: '12px', border: genero === g ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', background: genero === g ? 'rgba(59,130,246,0.1)' : 'transparent', color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{g}</button>
              ))}
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>COMPLEXIÓN</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', marginBottom: '1.5rem' }}>
              {COMPLEXION.map(c => (
                <button key={c.val} type="button" onClick={() => setComplexion(c.val)} style={{ padding: '0.75rem 0.5rem', borderRadius: '12px', border: complexion === c.val ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', background: complexion === c.val ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '4px' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{c.title}</strong>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.2 }}>{c.desc}</span>
                </button>
              ))}
            </div>

            <CustomSelect label="COLOR DE PIEL" options={COLORS_PIEL} value={piel} onChange={setPiel} placeholder="Seleccionar color" />
            <CustomSelect label="COLOR DE CABELLO" options={COLORS_CABELLO} value={cabello} onChange={setCabello} placeholder="Seleccionar color" />
            <CustomSelect label="COLOR DE OJOS" options={COLORS_OJOS} value={ojos} onChange={setOjos} placeholder="Seleccionar color" />

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              <Button fullWidth size="lg" onClick={() => setStep(3)}>ACEPTAR</Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 800 }}>Vestimenta</h3>
            
            <div className="form-group" style={{ opacity: sinVestimenta ? 0.4 : 1, pointerEvents: sinVestimenta ? 'none' : 'auto' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>PRENDA SUPERIOR</label>
              <input type="text" list="prenda-sup-opts" value={prendaSup} onChange={e => setPrendaSup(e.target.value)} placeholder="Ej: Camisa, sueter..." style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', marginBottom: '1rem' }} />
              <datalist id="prenda-sup-opts"><option value="Camisa"/><option value="Sueter"/><option value="Sin camisa"/><option value="Franela"/><option value="Camisa sin manga"/></datalist>
              
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>COLOR PRENDA SUPERIOR</label>
              <input type="text" value={colorSup} onChange={e => setColorSup(e.target.value)} placeholder="Ej: Rojo, Azul marino..." style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', marginBottom: '1.5rem' }} />

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>PRENDA INFERIOR</label>
              <input type="text" list="prenda-inf-opts" value={prendaInf} onChange={e => setPrendaInf(e.target.value)} placeholder="Ej: Pantalón, short..." style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', marginBottom: '1rem' }} />
              <datalist id="prenda-inf-opts"><option value="Pantalon"/><option value="Short"/><option value="Jean"/><option value="Mono"/><option value="Licra"/><option value="Falda"/></datalist>

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>COLOR PRENDA INFERIOR</label>
              <input type="text" value={colorInf} onChange={e => setColorInf(e.target.value)} placeholder="Ej: Negro, Azul claro..." style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', marginBottom: '1rem' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
              <input type="checkbox" checked={sinVestimenta} onChange={e => setSinVestimenta(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} />
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>No tengo información de esto</span>
            </label>

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              <Button fullWidth size="lg" onClick={() => setStep(4)}>ACEPTAR</Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 800 }}>Señas Particulares</h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.5rem' }}>
              {SENAS.map(s => {
                const active = senasSelected.includes(s.val);
                return (
                  <button 
                    key={s.val} 
                    type="button" 
                    onClick={() => toggleSena(s.val)}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      borderRadius: '50px', 
                      border: active ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)', 
                      background: active ? 'rgba(59,130,246,0.1)' : 'transparent', 
                      color: '#fff', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      textAlign: 'center'
                    }}
                  >
                    <strong style={{ fontSize: '0.95rem', marginBottom: '2px' }}>{s.label}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.desc}</span>
                  </button>
                )
              })}
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>DETALLE ADICIONAL / DESCRIPCIÓN</label>
            <textarea 
              rows={3}
              value={detalleAdicional} 
              onChange={e => setDetalleAdicional(e.target.value)} 
              placeholder="Ej. Cicatriz en antebrazo derecho, llevaba un bolso negro..." 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', resize: 'vertical' }} 
            />

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              <Button fullWidth size="lg" onClick={() => setStep(5)}>ACEPTAR</Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 800 }}>Ubicación y Envío</h3>
            
            {categoria === 'niño/a o adolescente' ? (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', marginBottom: '2rem' }}>
                <ShieldAlert size={36} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '8px' }}>Protección al Menor (LOPNNA)</strong>
                <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                  Por ley, no está permitido adjuntar fotografías o videos de menores de edad. Su reporte será enviado directamente a las autoridades correspondientes para un manejo confidencial.
                </p>
              </div>
            ) : (
              <label style={{ display: 'block', width: '100%', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '16px', padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', marginBottom: '2rem', position: 'relative' }}>
                <input type="file" accept="image/*,video/mp4" onChange={handleFileChange} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', cursor: 'pointer' }} />
                <Video size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
                <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>Subir Evidencia (Foto o Video)</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{file ? file.name : 'Toca para abrir la cámara o galería'}</span>
              </label>
            )}

            <button 
              type="button" 
              onClick={requestLocation}
              disabled={isRequestingLocation || locationSuccess}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '1rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: locationSuccess ? '#10b981' : '#fff', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', marginBottom: '1rem' }}
            >
              {isRequestingLocation ? <Loader2 className="spinner" size={20} /> : <MapPin size={20} />}
              {locationSuccess ? 'Ubicación Adjuntada' : 'Añadir mi Ubicación actual'}
            </button>

            <input 
              type="text" 
              value={calleEstado} 
              onChange={e => setCalleEstado(e.target.value)} 
              placeholder="Calle y estado..." 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff' }} 
            />

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              <Button fullWidth size="lg" onClick={submitReport} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="spinner" size={20} /> : 'SUBIR'}
              </Button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="report-step-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: '4rem' }}>
            {isOfflineSaved ? (
              <>
                <WifiOff size={80} color="#f59e0b" style={{ marginBottom: '1.5rem' }} />
                <h3 style={{ fontSize: '1.6rem', marginBottom: '1rem', fontWeight: 800, color: '#fff' }}>Guardado en Modo Sin Conexión</h3>
                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '3rem' }}>
                  El reporte ha sido guardado de manera local. Se sincronizará automáticamente tan pronto como tu dispositivo recupere conexión a Internet.
                </p>
              </>
            ) : (
              <>
                <CheckCircle size={80} color="#10b981" style={{ marginBottom: '1.5rem' }} />
                <h3 style={{ fontSize: '1.6rem', marginBottom: '1rem', fontWeight: 800, color: '#fff' }}>¡Tu reporte se ha realizado exitosamente!</h3>
                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '3rem' }}>
                  Nos comunicaremos contigo en caso de necesitar información extra.
                </p>
              </>
            )}

            <div style={{ width: '100%', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Button fullWidth size="lg" onClick={onClose} style={{ backgroundColor: '#fff', color: '#000', fontWeight: 800 }}>FINALIZAR</Button>
              <Button fullWidth size="lg" variant="outline" onClick={() => { setStep(1); resetFields(); }} style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent' }}>
                <Plus size={20} /> Hacer nuevo reporte
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="report-modal-overlay">
      <div className="report-modal-content">
        <header className="report-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {step > 2 && step < 6 ? (
            <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
          ) : step === 1 ? (
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 20 }} />
          )}
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '2px' }}>
            {step < 6 ? 'CREAR REPORTE' : 'FINALIZADO'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </header>
        <div className="report-modal-body" style={{ height: 'calc(100dvh - 60px)', padding: '1.5rem', overflowY: 'auto', paddingBottom: 'calc(var(--bottom-nav-h, 70px) + 2rem)' }}>
          {renderStep()}
        </div>
      </div>
      {error && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '16px', padding: '2rem', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
            <ShieldAlert size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <strong style={{ display: 'block', fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Atención</strong>
            <p style={{ color: '#cbd5e1', marginBottom: '2rem' }}>{error}</p>
            <Button fullWidth onClick={() => setError('')} style={{ background: '#ef4444' }}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
};
