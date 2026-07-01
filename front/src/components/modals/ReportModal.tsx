import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, Check, MapPin, ShieldAlert, Video, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { AudioRecorder } from './AudioRecorder';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../ui/Button';
import { BrandMark } from '../BrandMark';
import { MobileBottomNav } from '../../layouts/MobileBottomNav';
import './ReportModal.css';

interface ReportModalProps {
  onClose: () => void;
  onGoDirectory?: () => void;
  onNavigate?: (view: any) => void;
  defaultType?: 'person' | 'animal';
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="report-card">
    <div className="report-card-body">
      {children}
    </div>
  </div>
);

const locationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

export const ReportModal: React.FC<ReportModalProps> = ({ onClose, onGoDirectory, onNavigate, defaultType = 'person' }) => {
  const [reportAction, setReportAction] = useState<'vi' | 'deceso'>('vi');
  const [category, setCategory] = useState<'adulto' | 'niño' | 'adulto_mayor' | 'mascota'>(defaultType === 'animal' ? 'mascota' : 'adulto');
  const [cedulaNac, setCedulaNac] = useState<'V' | 'E'>('V');
  const [cedula, setCedula] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [raza, setRaza] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [clothingQuestion, setClothingQuestion] = useState('');
  
  const [reporterLocation, setReporterLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [clientIp, setClientIp] = useState<string>('Obteniendo...');

  React.useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('Oculta (Protegida)'));
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }
    setIsRequestingLocation(true);

    const fallbackTimeout = setTimeout(() => {
      setIsRequestingLocation(false);
      setError('Tiempo de espera agotado. El sistema operativo no devolvió la ubicación GPS.');
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(fallbackTimeout);
        setReporterLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationSuccess(true);
        setIsRequestingLocation(false);
        
        try {
          // Reverse geocoding to auto-fill state
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          if (data && data.address) {
            const locName = data.address.state || data.address.city || data.address.county;
            if (locName) setEstado(locName);
          }
        } catch (e) {
          console.error('Error in reverse geocoding', e);
        }
      },
      (_err) => {
        clearTimeout(fallbackTimeout);
        setError('No se pudo obtener la ubicación (Asegúrate de tener el GPS activado en tu Sistema Operativo).');
        setIsRequestingLocation(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Permit submission depending on category
  // const canSubmit = Boolean(name.trim() && estado.trim() && text.trim()) && !isSubmitting;

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
      if (file && reportAction !== 'deceso') {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoUrl = uploadRes.data.url;
      }

      const isAnimal = category === 'mascota';
      
      const payloadText = `Categoría: ${isAnimal ? 'Mascota' : (category === 'adulto' ? 'Adulto' : (category === 'adulto_mayor' ? 'Adulto Mayor' : 'Niño'))}
${isAnimal && raza ? `Raza: ${raza}\n` : ''}${reportAction === 'vi' ? '[REPORTE: HE VISTO / LOCALIZADO]' : '[REPORTE: DECESO / FALLECIMIENTO]'} ${isAnonymous ? '[ANÓNIMO]' : ''}
${text.trim()}`.trim();

      const payload: any = {
        source: 'manual',
        externalId: `manual_${Date.now()}`,
        type: isAnimal ? 'animal' : 'person',
        name: name.trim(),
        estado: estado.trim(),
        text: payloadText,
        date: new Date().toISOString(),
        isAnonymous,
        reporterLocation
      };
      
      if (photoUrl) payload.photoUrl = photoUrl;
      if (!isAnimal && cedula) payload.data = { cedula_hash: cedula }; // Send cedula if exists
      if (!isAnimal && category === 'niño') {
        payload.data = { ...payload.data, age: '10' }; // Hack to enforce minor logic in backend
      }

      await api.post('/persons', payload);
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Hubo un error al enviar el reporte. Por favor intenta de nuevo.');
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="report-modal-overlay" onClick={handleBackdropClick}>
      <div className="report-modal-content" role="dialog" aria-modal="true">
        
        <header className="report-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BrandMark size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 1 }}>
              <span style={{ fontSize: 'min(0.75rem, 3.2vw)', fontWeight: 800, lineHeight: 1.2, color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Reencuentro Terremotos</span>
              <span style={{ fontSize: 'min(0.6rem, 2.2vw)', fontWeight: 400, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Venezuela</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {onGoDirectory && (
              <button 
                type="button" 
                onClick={onGoDirectory} 
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                  color: '#e2e8f0', 
                  border: 'none', 
                  borderRadius: '20px', 
                  padding: '0.35rem 0.6rem', 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap'
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                CANAL SOS
              </button>
            )}
          </div>
        </header>

        <div className="report-modal-body">
          {isSuccess ? (
            <div className="success-state">
              <CheckCircle size={64} color={reportAction === 'deceso' ? "var(--clr-amber)" : "var(--clr-success)"} style={{ margin: '0 auto' }} />
              <h3>{reportAction === 'deceso' ? 'Reporte Registrado' : '¡Reporte enviado exitosamente!'}</h3>
              <p>
                {reportAction === 'deceso' 
                  ? 'Hemos recibido la información. Para proteger a la familia y evitar la exposición de material sensible, un moderador especializado se pondrá en contacto contigo a la brevedad posible para manejar este caso de forma privada y respetuosa.' 
                  : 'Nuestra Inteligencia Artificial está analizando y organizando la información. En unos minutos aparecerá en el mapa.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="report-modal-cards-layout">

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.25rem', padding: '0 0.25rem' }}>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose} 
                  aria-label="Volver" 
                  style={{ width: '38px', height: '38px', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft size={20} />
                </Button>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.55rem', 
                  fontWeight: 800, 
                  color: 'var(--clr-text)', 
                  letterSpacing: '-0.02em' 
                }}>
                  Reportar
                </h2>
              </div>

              {/* CARD 1: CATEGORIA */}
              <Card>


                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
                    CATEGORÍAS
                  </label>
                  <div className="category-grid">
                    <button type="button" className={`category-btn ${category === 'niño' ? 'active-red' : ''}`} onClick={() => setCategory('niño')} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>Niño | Niña</span>
                      <span style={{ fontSize: '0.7em', fontWeight: 500, opacity: 0.85 }}>o Adolescente</span>
                    </button>
                    <button type="button" className={`category-btn ${category === 'adulto' ? 'active-blue' : ''}`} onClick={() => setCategory('adulto')}>
                      Adulto
                    </button>
                    <button type="button" className={`category-btn ${category === 'adulto_mayor' ? 'active-blue' : ''}`} onClick={() => setCategory('adulto_mayor')}>
                      Adulto Mayor
                    </button>
                    <button type="button" className={`category-btn ${category === 'mascota' ? 'active-blue' : ''}`} onClick={() => setCategory('mascota')}>
                      Mascota
                    </button>
                  </div>
                </div>

                {category === 'niño' && (
                  <div className="ai-notice" style={{ marginTop: '1rem', marginBottom: 0, backgroundColor: 'rgba(255, 193, 7, 0.1)', color: 'var(--clr-amber)', borderColor: 'rgba(255, 193, 7, 0.3)' }}>
                    <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Protección LOPNNA</strong>
                      <p style={{ margin: 0, marginTop: 4 }}>
                        Al reportar a un menor, un moderador especializado se pondrá en contacto contigo para manejar el caso de forma personal y segura, protegiendo siempre la identidad del infante.
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* CARD 2: EVIDENCIA (No se muestra en deceso) */}
              {reportAction !== 'deceso' && (
                <Card>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
                      GRABAR VIDEO / TOMAR FOTO
                    </label>
                    <div className="upload-dropzone">
                      <input 
                        type="file" 
                        accept="image/*,video/mp4" 
                        onChange={handleFileChange}
                        disabled={isSubmitting || isAnalyzingImage}
                      />
                      <div className="upload-dropzone-content">
                        <Video size={40} color="var(--clr-text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                        <span style={{ color: 'var(--clr-text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
                          {file ? file.name : ''}
                        </span>
                      </div>
                    </div>
                    
                    {isAnalyzingImage && (
                      <div className="report-modal-analyzing-msg" style={{ marginTop: '0.75rem' }}>
                        <Loader2 size={16} className="spinner" /> La IA está analizando los rasgos de la foto...
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* CARD 3: DATOS DINAMICOS */}
              <Card>
                


                <div className="form-group">
                  <label>
                    {category === 'mascota' ? 'Nombre o Alias de la Mascota' : 'Nombre Completo'} <span className="required-mark">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder={category === 'mascota' ? "Ej: Firulais" : "Ej: María Elena Rodríguez"} 
                    disabled={isSubmitting}
                  />
                </div>

                {category === 'mascota' && (
                  <div className="form-group">
                    <label>Raza o Tipo de Animal <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.8em' }}>- Opcional</span></label>
                    <input 
                      type="text" 
                      value={raza} 
                      onChange={(e) => setRaza(e.target.value)} 
                      placeholder="Ej: Perro Poodle, Gato Mestizo" 
                      disabled={isSubmitting}
                    />
                  </div>
                )}

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

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Ubicación GPS <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.8em' }}>- Opcional pero ayuda a validar</span></label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={requestLocation}
                      disabled={isRequestingLocation || locationSuccess || isSubmitting}
                    >
                      {isRequestingLocation ? <Loader2 size={16} className="spinner" /> : <><MapPin size={16} style={{marginRight: 6}} /> Adjuntar mi ubicación actual</>}
                    </Button>
                    {locationSuccess && <span style={{ color: 'var(--clr-success)', fontSize: '0.9em', fontWeight: 600 }}>¡Ubicación adjuntada! ✓</span>}
                  </div>
                </div>

              </Card>

              {/* CARD 4: DESCRIPCION LIBRE */}
              <Card>
                <div className="ai-notice" style={{ padding: '0.75rem', marginBottom: '1.25rem' }}>
                  <Sparkles size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>Asistente de IA Activo</strong>
                    <p style={{ margin: 0, marginTop: 2, fontSize: '0.75rem', lineHeight: 1.4 }}>
                      Nuestra inteligencia artificial se encargará de manejar los datos de manera segura.
                    </p>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
                    {category === 'mascota' ? 'DESCRIPCIÓN DE LA MASCOTA' : 'DESCRIPCIÓN DE LA PERSONA'}
                  </label>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <AudioRecorder 
                      onTranscription={(transcribedText) => {
                        setText((prev) => prev ? `${prev}\n${transcribedText}` : transcribedText);
                      }} 
                    />
                  </div>

                  <textarea 
                    value={text} 
                    onChange={(e) => setText(e.target.value)} 
                    placeholder={
                      category === 'mascota' ? "Describe características físicas, collar, marcas de nacimiento o accesorios..." : "Describe características corporales, ropa o accesorios..."
                    }
                    disabled={isSubmitting}
                    style={{ 
                      backgroundColor: '#0b1120', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      borderRadius: '12px', 
                      padding: '1rem', 
                      minHeight: '120px', 
                      width: '100%', 
                      color: 'var(--clr-text)', 
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                  ></textarea>

                  {clothingQuestion && (
                    <div className="report-modal-ai-box">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <Sparkles size={18} style={{ color: 'var(--clr-amber)', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Pregunta del Asistente</strong>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {clothingQuestion}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            <Button type="button" variant="outline" size="sm" onClick={() => { setText(prev => prev + '\nLlevaba esa misma ropa al momento de desaparecer.'); setClothingQuestion(''); }}>Sí, llevaba esa ropa</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setText(prev => prev + '\nNO llevaba esa ropa al momento de desaparecer.'); setClothingQuestion(''); }}>No llevaba eso</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* CARD 5: METADATOS */}
              <Card>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '1rem', display: 'block' }}>
                    METADATOS DE CAPTURA
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>📍</span>
                      <strong style={{ color: 'var(--clr-text)' }}>Ubicación:</strong> 
                      {reporterLocation ? `${estado || 'GPS Activo'} (Se mantienen coordenadas ocultas por seguridad)` : (estado || 'No proporcionada')}
                    </div>
                    {file && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>📸</span>
                        <strong style={{ color: 'var(--clr-text)' }}>Archivo:</strong> 
                        {file.name} ({formatFileSize(file.size)})
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>🕒</span>
                      <strong style={{ color: 'var(--clr-text)' }}>Hora:</strong> 
                      {new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>🌐</span>
                      <strong style={{ color: 'var(--clr-text)' }}>IP:</strong> 
                      {clientIp}
                    </div>
                  </div>

                  {reporterLocation && (
                    <div style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', height: '150px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <MapContainer 
                        center={[reporterLocation.lat, reporterLocation.lng]} 
                        zoom={14} 
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                      >
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={[reporterLocation.lat, reporterLocation.lng]} icon={locationIcon} />
                      </MapContainer>
                    </div>
                  )}
                </div>
              </Card>

              {/* ACCIONES FINALES */}

              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? (
                  <><Loader2 size={20} className="spinner" /> PROCESANDO...</>
                ) : (
                  'SUBIR'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ERROR ALERT MODAL */}
      {error && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '320px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
          }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ShieldAlert size={28} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>Atención</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {error}
            </p>
            <button 
              type="button"
              onClick={() => setError('')}
              style={{
                width: '100%',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.8rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* ─ Bottom Nav Cloned for Modal (Mobile only) ─ */}
      <MobileBottomNav
        activeView="report"
        className="modal-bottom-nav"
        onNavigate={(v) => { onNavigate?.(v as any); }}
        onReport={(e) => e.stopPropagation()}
        onMoreClick={(e) => { e.stopPropagation(); onClose(); }}
      />

    </div>
  );
};
