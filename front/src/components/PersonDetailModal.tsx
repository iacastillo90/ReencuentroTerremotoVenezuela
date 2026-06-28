import React from 'react';
import type { Person } from '../types';
import { 
  X, MapPin, User, Phone, CheckCircle, Heart, 
  MessageCircle, AlertCircle, Share2, Info
} from 'lucide-react';
import './PersonDetailModal.css';

interface PersonDetailModalProps {
  person: Person;
  onClose: () => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose }) => {
  const isMissing = person.status === 'missing';

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
                {person.data?.origen && <span>Fuente: {person.data.origen}</span>}
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn-main-action btn-contact">
              <MessageCircle size={18} />
              Tengo información
            </button>
            {isMissing && (
              <button className="btn-main-action btn-confirm-safe">
                <CheckCircle size={18} />
                Confirmar que está a salvo
              </button>
            )}
          </div>

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
                <label>Descripción / Señas particulares</label>
                <p>{person.lastSeen?.description || person.description || 'Sin descripción adicional proporcionada por la fuente.'}</p>
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
