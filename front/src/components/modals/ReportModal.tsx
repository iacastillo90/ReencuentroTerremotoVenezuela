import React, { useState, useEffect } from 'react';
import { ArrowLeft, Baby, CheckCircle, ChevronDown, Dog, Heart, Info, Loader2, MapPin, ShieldAlert, Sparkles, Star, User, Video, Plus, X, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { db } from '../../db/offlineDb';
import { AudioRecorder } from './AudioRecorder';
import { Button } from '../ui/Button';
import { BrandMark } from '../BrandMark';
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
    <div className="figma-select-field">
      <label>{label}</label>
      <div className="figma-select-trigger" onClick={() => setOpen(!open)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setOpen(!open)}>
        {selected ? (
          <>
            {selected.hex && <div className="swatch" style={{ backgroundColor: selected.hex }} />}
            <span className="select-label">{selected.label}</span>
          </>
        ) : (
          <span className="select-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} className={`chevron ${open ? 'open' : ''}`} />
      </div>
      {open && (
        <>
          <div className="figma-select-backdrop" onClick={() => setOpen(false)} />
          <div className="figma-select-dropdown">
            {options.map((o: any) => (
              <div key={o.val} onClick={() => { onChange(o.val); setOpen(false); }} className={`figma-select-option ${value === o.val ? 'selected' : ''}`}>
                {o.hex && <div className="option-swatch" style={{ backgroundColor: o.hex }} />}
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ReportModal: React.FC<ReportModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(1); // Inicia en selección de categoría
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Step 1 / General Description
  const [audioText, setAudioText] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [edad, setEdad] = useState('');

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
    setNombreCompleto('');
    setEdad('');
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
        setStep(7);
        return;
      }

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.photoUrl = uploadRes.data.url;
      }

      await api.post('/persons', payload);
      setStep(7);
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
          <div className="report-step-content">
            <div className="category-grid-2x2">
              {[
                { val: 'niño/a o adolescente', icon: Baby, label: 'Niño/a o\nadolescente' },
                { val: 'adulto', icon: User, label: 'Adulto' },
                { val: 'adulto mayor', icon: Heart, label: 'Adulto\nmayor' },
                { val: 'mascota', icon: Dog, label: 'Mascota' },
              ].map(c => {
                const Icon = c.icon;
                const active = categoria === c.val;
                return (
                  <button key={c.val} type="button" onClick={() => setCategoria(c.val)} className={`category-microcard ${active ? 'selected' : ''}`}>
                    <div className="card-icon"><Icon size={28} /></div>
                    <span className="card-label">{c.label}</span>
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={() => setStep(2)} className="btn-ai-assist">
              <Sparkles size={20} /> Reportar con Asistente IA
            </button>

            <div className="sticky-bottom-action">
              <div className="report-footer-privacy">
                <Info size={14} />
                <span>Nuestra inteligencia artificial manejará los datos de manera segura.</span>
              </div>
              <div className="step-submit-row">
                <Button fullWidth size="lg" onClick={() => setStep(3)} disabled={!categoria}>SIGUIENTE</Button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="report-step-content">
            <div className="ai-notification-card">
              <div className="card-title">
                <Sparkles size={20} color="#4497D6" />
                <span>Asistente IA de Voz</span>
              </div>
              <p className="card-description">Usa el asistente de voz. Trata de mencionar detalles como si es niño/adulto, cómo está vestido y características físicas.</p>
            </div>
            <AudioRecorder 
              currentText={audioText}
              onStartRecording={resetFields}
              onTranscription={(txt) => {
                setAudioText(txt);
              }} 
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

      case 3:
        return (
          <div className="report-step-content">
            
            <div className="figma-section">
              <label className="figma-section-label">Género</label>
              <div className="figma-card-group">
                {['Masculino', 'Femenino'].map(g => (
                  <button key={g} type="button" onClick={() => setGenero(g)} className={`figma-card-gender ${genero === g ? 'selected' : ''}`}>{g}</button>
                ))}
              </div>
            </div>

            <div className="figma-input-field">
              <label>NOMBRE (Opcional)</label>
              <input type="text" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} placeholder="¿Conoces el nombre de esta persona?" />
            </div>

            <div className="figma-input-field">
              <label>EDAD APROXIMADA (Opcional)</label>
              <input type="number" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Ej. 25" />
            </div>

            <div className="figma-section">
              <label className="figma-section-label">Complexión</label>
              <div className="figma-card-group">
                {COMPLEXION.map(c => (
                  <button key={c.val} type="button" onClick={() => setComplexion(c.val)} className={`figma-card ${complexion === c.val ? 'selected' : ''}`}>
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

      case 4:
        return (
          <div className="report-step-content">
            <div className={sinVestimenta ? 'figma-muted-group' : ''}>
              <div className="figma-input-field">
                <label>PRENDA SUPERIOR</label>
                <input type="text" list="prenda-sup-opts" value={prendaSup} onChange={e => setPrendaSup(e.target.value)} placeholder="Ej: Camisa, sueter..." />
                <datalist id="prenda-sup-opts"><option value="Camisa"/><option value="Sueter"/><option value="Sin camisa"/><option value="Franela"/><option value="Camisa sin manga"/></datalist>
              </div>
              <div className="figma-input-field">
                <label>COLOR PRENDA SUPERIOR</label>
                <input type="text" value={colorSup} onChange={e => setColorSup(e.target.value)} placeholder="Ej: Rojo, Azul marino..." />
              </div>
              <div className="figma-input-field">
                <label>PRENDA INFERIOR</label>
                <input type="text" list="prenda-inf-opts" value={prendaInf} onChange={e => setPrendaInf(e.target.value)} placeholder="Ej: Pantalón, short..." />
                <datalist id="prenda-inf-opts"><option value="Pantalon"/><option value="Short"/><option value="Jean"/><option value="Mono"/><option value="Licra"/><option value="Falda"/></datalist>
              </div>
              <div className="figma-input-field">
                <label>COLOR PRENDA INFERIOR</label>
                <input type="text" value={colorInf} onChange={e => setColorInf(e.target.value)} placeholder="Ej: Negro, Azul claro..." />
              </div>
            </div>

            <label className="figma-checkbox-row">
              <input type="checkbox" checked={sinVestimenta} onChange={e => setSinVestimenta(e.target.checked)} />
              <span>No tengo información de esto</span>
            </label>

            <div className="step-submit-row">
              <Button fullWidth size="lg" onClick={() => setStep(5)}>ACEPTAR</Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="report-step-content">
            <div className="figma-feature-btn-group">
              {SENAS.map(s => {
                const active = senasSelected.includes(s.val);
                return (
                  <button key={s.val} type="button" onClick={() => toggleSena(s.val)} className={`figma-feature-btn ${active ? 'active' : ''}`}>
                    <div className="radio-circle" />
                    <div className="feature-text">
                      <strong>{s.label}</strong>
                      <span>{s.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="figma-input-field">
              <label>DETALLE ADICIONAL / DESCRIPCIÓN</label>
              <textarea rows={3} value={detalleAdicional} onChange={e => setDetalleAdicional(e.target.value)} placeholder="Ej. Cicatriz en antebrazo derecho, llevaba un bolso negro..." />
            </div>

            <div className="step-submit-row">
              <Button fullWidth size="lg" onClick={() => setStep(6)}>ACEPTAR</Button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="report-step-content">
            {categoria === 'niño/a o adolescente' ? (
              <div className="figma-alert-danger">
                <ShieldAlert size={36} color="#ef4444" className="centered-icon" />
                <strong>Protección al Menor (LOPNNA)</strong>
                <p>Por ley, no está permitido adjuntar fotografías o videos de menores de edad. Su reporte será enviado directamente a las autoridades correspondientes para un manejo confidencial.</p>
              </div>
            ) : (
              <label className="figma-upload-area">
                <input type="file" accept="image/*,video/mp4" onChange={handleFileChange} />
                <Video size={48} color="#94a3b8" className="centered-icon" />
                <strong>Subir Evidencia (Foto o Video)</strong>
                <span>{file ? file.name : 'Toca para abrir la cámara o galería'}</span>
              </label>
            )}

            <button type="button" onClick={requestLocation} disabled={isRequestingLocation || locationSuccess} className={`figma-location-btn ${locationSuccess ? 'success' : ''}`}>
              {isRequestingLocation ? <Loader2 className="spinner" size={20} /> : <MapPin size={20} />}
              {locationSuccess ? 'Ubicación Adjuntada' : 'Añadir mi Ubicación actual'}
            </button>

            <div className="figma-input-field">
              <label>CALLE Y ESTADO (Opcional)</label>
              <input type="text" value={calleEstado} onChange={e => setCalleEstado(e.target.value)} placeholder="Calle y estado..." />
            </div>

            {reporterLocation && (
              <div style={{ marginTop: '1rem', padding: '12px', background: '#1c1c1e', borderRadius: '8px', border: '1px solid #333', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', background: '#333', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={24} color="#34d399" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Ubicación adjunta</span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>Lat: {reporterLocation.lat.toFixed(4)} | Lng: {reporterLocation.lng.toFixed(4)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>IP: Obtenida por el sistema</span>
                </div>
                <CheckCircle size={20} color="#34d399" />
              </div>
            )}

            <div className="step-submit-row">
              <Button fullWidth size="lg" onClick={submitReport} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="spinner" size={20} /> : 'SUBIR'}
              </Button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="report-step-content-centered">
            {isOfflineSaved ? (
              <>
                <WifiOff size={80} color="#f59e0b" className="success-hero-icon" />
                <h3 className="success-heading">Guardado en Modo Sin Conexión</h3>
                <p className="success-description">El reporte ha sido guardado de manera local. Se sincronizará automáticamente tan pronto como tu dispositivo recupere conexión a Internet.</p>
              </>
            ) : (
              <>
                <CheckCircle size={80} color="#10b981" className="success-hero-icon" />
                <h3 className="success-heading">¡Tu reporte se ha realizado exitosamente!</h3>
                <p className="success-description">Nos comunicaremos contigo en caso de necesitar información extra.</p>
              </>
            )}

            <div className="success-actions">
              <Button fullWidth size="lg" onClick={onClose} className="btn-finalize">FINALIZAR</Button>
              <Button fullWidth size="lg" variant="outline" onClick={() => { setStep(1); resetFields(); }} className="btn-new-report">
                <Plus size={20} /> Hacer nuevo reporte
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {step > 1 && step < 7 ? (
              <button onClick={() => { if (step === 2) setStep(1); else if (step === 3) setStep(audioText ? 2 : 1); else setStep(s => s - 1); }} style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer', zIndex: 10 }}>
                <ArrowLeft size={20} />
              </button>
            ) : null}

            <div className="nav-brand" style={{ margin: 0, padding: 0 }}>
              <BrandMark size={34} />
              <span className="nav-brand-text">
                <strong>Reencuentros<span>Venezuela</span></strong>
                <small>Juntos te encontramos</small>
              </span>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
            <X size={18} />
          </button>
        </header>

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
          <div key={step} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{renderStep()}</div>
        </div>
      </div>
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
