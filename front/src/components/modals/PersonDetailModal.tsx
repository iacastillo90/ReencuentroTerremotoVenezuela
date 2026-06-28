import React, { useState } from 'react';
import type { Person } from '../../types';
import { 
  X, MapPin, User, CheckCircle, Heart, 
  MessageCircle, AlertCircle, Share2, Info, Lock
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { api } from '../../services/api';
import './PersonDetailModal.css';

interface PersonDetailModalProps {
  person: Person;
  onClose: () => void;
  onReport?: () => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, onReport }) => {
  const isMissing = person.status === 'missing';
  
  // Security
  const { user } = useAuth();
  const [cedulaInput, setCedulaInput] = useState('');
  const [cedulaMatched, setCedulaMatched] = useState(false);

  const canViewSensitive = isMissing || cedulaMatched || user?.role === 'admin' || user?.role === 'verifier';

  // Contact
  const [showContactForm, setShowContactForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Debes iniciar sesión para enviar un mensaje.");
      return;
    }
    try {
      setSending(true);
      await api.post('/contacts', { reportId: person.idHash, message });
      alert("Mensaje enviado exitosamente. El reportante será notificado de forma segura.");
      setShowContactForm(false);
      setMessage('');
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  };

  const handleCedulaMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (person.data?.cedula && cedulaInput.trim() === person.data.cedula) {
      setCedulaMatched(true);
    } else {
      alert("Cédula incorrecta. Si eres familiar, verifica el documento. De lo contrario, solicita acceso a un moderador.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getGenderText = (g?: string) => {
    if (g === 'M') return 'Masculino';
    if (g === 'F') return 'Femenino';
    if (g === 'other') return 'Otro';
    return 'No especificado';
  };

  const formattedDate = person.lastSeen?.date 
    ? new Date(person.lastSeen.date).toLocaleDateString('es-VE', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      })
    : 'Fecha desconocida';

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content" role="dialog" aria-modal="true">
        
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>{person.name}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={24} />
          </button>
        </header>

        <div className="modal-body">
          <div className="person-hero">
            <div className="hero-image-wrapper">
              {person.photoUrl ? (
                <img src={person.photoUrl} alt={`Foto de ${person.name}`} className="hero-image" />
              ) : (
                <User size={48} color="var(--text-secondary)" />
              )}
            </div>
            
            <div className="hero-info">
              <span className={`hero-badge ${isMissing ? 'missing' : 'found'}`}>
                {isMissing ? 'Aún sin contacto' : 'Localizado / A Salvo'}
              </span>
              <div className="hero-meta">
                <span><MapPin size={14} style={{ display: 'inline', marginRight: 4 }} /> {person.lastSeen?.state || 'Ubicación desconocida'}</span>
                <span>Última actualización: {formattedDate}</span>
                {person.age && <span>Edad aproximada: {person.age} años</span>}
                {canViewSensitive ? (
                  <>
                    {person.data?.origen && <span>Fuente: {person.data.origen}</span>}
                    {person.data?.verificado_por && (
                      <span style={{ color: 'var(--clr-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} /> Verificado por {person.data.verificado_por}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--clr-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={14} /> Datos de refugio ocultos
                  </span>
                )}

                {person.data?.ficha_url && (
                  <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
                    <a href={person.data.ficha_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} /> Ver ficha original
                    </a>
                  </span>
                )}

                {person.metadata?.reportedBy && <span><User size={12} style={{ display: 'inline', marginRight: 4 }}/> Reportado por: {person.metadata.reportedBy.name}</span>}
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn-main-action btn-contact" onClick={() => setShowContactForm(!showContactForm)}>
              <MessageCircle size={18} />
              Contactar (Enmascarado)
            </button>
            {isMissing && (
              <button className="btn-main-action btn-confirm-safe" onClick={() => onReport && onReport()}>
                <CheckCircle size={18} />
                Tengo información adicional
              </button>
            )}
          </div>

          {showContactForm && (
            <div style={{ background: '#0f172a', padding: '15px', borderRadius: '8px', margin: '15px', border: '1px solid #1e293b' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}><Lock size={16} color="var(--clr-amber)" /> Comunicación Segura</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Tu mensaje será enviado al familiar/reportante sin revelar tus datos de contacto iniciales. El equipo de AyudaVE intermediará si es necesario.
              </p>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea 
                  placeholder="Escribe aquí tu mensaje sobre esta persona..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff', minHeight: '80px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" disabled={sending} style={{ background: 'var(--blue)', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    {sending ? 'Enviando...' : 'Enviar Mensaje'}
                  </button>
                  <button type="button" onClick={() => setShowContactForm(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--text-secondary)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="info-section">
            <h3><Info size={18} /> Información y Señas</h3>
            <div className="info-grid">
              {person.data?.cedula && (
                <div className="info-item">
                  <label>Cédula / documento</label>
                  <p>{person.data.cedula}</p>
                </div>
              )}
              <div className="info-item">
                <label>Género</label>
                <p>{getGenderText(person.gender)}</p>
              </div>
              <div className="info-item">
                <label>Última vez visto en</label>
                <p>{person.lastSeen?.municipality ? `${person.lastSeen.municipality}, ` : ''}{person.lastSeen?.state || 'Desconocido'}</p>
              </div>
              <div className="info-item full-width">
                <label>Descripción / Detalles</label>
                {canViewSensitive ? (
                  <p>{person.lastSeen?.description || person.description || 'Sin descripción adicional proporcionada por la fuente.'}</p>
                ) : (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed #334155' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <Lock size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Esta persona fue localizada. Por su seguridad, la ubicación exacta y el detalle del refugio están protegidos. Si eres familiar, introduce su cédula para ver los datos:
                    </p>
                    <form onSubmit={handleCedulaMatch} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Cédula de Identidad" 
                        value={cedulaInput}
                        onChange={e => setCedulaInput(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff', flex: 1 }}
                      />
                      <button type="submit" style={{ padding: '6px 14px', borderRadius: '4px', background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        Verificar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="info-section" style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <h3 style={{ color: '#d97706' }}><AlertCircle size={18} /> Avisos de la comunidad</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Esta información es enviada por la comunidad y no ha sido verificada oficialmente.
            </p>
            <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>
              Aún no hay reportes de la comunidad para esta persona.
            </p>
          </div>

          <div className="resources-box">
            <h4><Heart size={18} /> Recursos de Emergencia</h4>
            <div className="emergency-grid">
              <div className="emergency-item">
                <span>Emergencias Gral.</span>
                <strong>171 / 911</strong>
              </div>
              <div className="emergency-item">
                <span>Protección Civil</span>
                <strong>0800-PCIVIL1</strong>
              </div>
              <div className="emergency-item">
                <span>Movilnet / Movistar</span>
                <strong>*1 / 911</strong>
              </div>
              <div className="emergency-item">
                <span>Digitel</span>
                <strong>112</strong>
              </div>
            </div>
          </div>

          <div className="social-share">
            <p>Cuantas más personas conozcan el registro, a más gente ayuda.</p>
            <div className="share-buttons">
              <button className="btn-share whatsapp">
                <Share2 size={16} /> Compartir WhatsApp
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
