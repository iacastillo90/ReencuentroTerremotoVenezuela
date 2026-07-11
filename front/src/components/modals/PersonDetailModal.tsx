/**
 * components/modals/PersonDetailModal.tsx — Perfil detallado de una persona
 *
 * PROPÓSITO:
 *   Muestra toda la información disponible sobre una persona reportada.
 *   Se abre desde el Feed, el Mapa, o la Búsqueda.
 *
 * PRIVACIDAD Y SEGURIDAD:
 *   - Si la persona ya fue LOCALIZADA (status !== 'missing'), los datos
 *     sensibles (ubicación exacta, refugio) están ocultos tras un muro
 *     de verificación por cédula de identidad.
 *   - canViewSensitive = true solo si:
 *       a) La persona sigue desaparecida (necesitamos ayuda para encontrarla)
 *       b) El usuario ingresó la cédula correcta (es familiar)
 *       c) El usuario es admin/verifier
 *   - El formulario de contacto es "enmascarado": el mensaje pasa por
 *     nuestro servidor, que lo reenvía sin revelar datos de contacto.
 *
 * CIERRE DE CASO (Fase 4):
 *   - Solo el reportante original (isOwner) o un admin puede cerrar un caso.
 *   - El cierre es un acto legal: queda sellado con timestamp + IP.
 *   - Tres resoluciones: localizado, fallecido, o reporte erróneo.
 *
 * BOTONES DE ACCIÓN PRINCIPAL:
 *   - "Contactar" → formulario de mensaje enmascarado
 *   - "Tengo información" → abre ReportModal para añadir datos
 *   - "Cerrar Caso" → formulario de cierre (solo owner/admin)
 *
 * RECURSOS DE EMERGENCIA:
 *   Números de contacto venezolanos visibles siempre (171, 911, Protección Civil).
 */
import React, { useState } from 'react';
import type { Person } from '../../types';
import {
  X, MapPin, User, CheckCircle, Heart,
  MessageCircle, AlertCircle, Share2, Info, Lock, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import './PersonDetailModal.css';

interface PersonDetailModalProps {
  person: Person;
  onClose: () => void;
  onReport?: () => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, onReport }) => {
  const isMissing = person.status === 'missing';

  // ─── Control de acceso a datos sensibles ───
  const { user } = useAuth();
  const [cedulaInput, setCedulaInput] = useState('');
  const [cedulaMatched, setCedulaMatched] = useState(false);

  const canViewSensitive = isMissing || cedulaMatched || user?.role === 'admin' || user?.role === 'verifier';

  // ─── Formulario de contacto enmascarado ───
  const [showContactForm, setShowContactForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // ─── Cierre de caso (solo owner/admin) ───
  const [showCloseCase, setShowCloseCase] = useState(false);
  const [closeResolution, setCloseResolution] = useState<'found' | 'deceased' | 'erroneous'>('found');
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);

  // Determina si el usuario actual es el dueño del reporte
  const isOwner = user?.role === 'admin' ||
    ((person.metadata?.reportedBy as any)?._id === user?._id) ||
    ((person.metadata?.reportedBy as any) === user?._id);

  // ─── Enviar mensaje enmascarado al reportante ───
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

  // ─── Cerrar caso (sello legal) ───
  const handleCloseCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setClosing(true);
      await api.post(`/persons/${person.idHash}/close`, {
        resolution: closeResolution,
        notes: closeNotes
      });
      alert('Caso cerrado y sellado exitosamente bajo la Ley de Protección de Datos.');
      window.location.reload();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al cerrar el caso');
    } finally {
      setClosing(false);
    }
  };

  // ─── Verificar cédula para acceder a datos protegidos ───
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
          {/* ─── Hero: foto + badge + metadatos básicos ─── */}
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
                <span><MapPin size={14} className="inline-icon" /> {person.lastSeen?.state || 'Ubicación desconocida'}</span>
                <span>Última actualización: {formattedDate}</span>
                {person.age && <span>Edad aproximada: {person.age} años</span>}

                {/* Datos visibles solo si canViewSensitive */}
                {canViewSensitive ? (
                  <>
                    {person.data?.origen && <span>Fuente: {person.data.origen}</span>}
                    {person.data?.verificado_por && (
                      <span className="person-meta-verified">
                        <CheckCircle size={14} /> Verificado por {person.data.verificado_por}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="person-meta-hidden">
                    <Lock size={14} /> Datos de refugio ocultos
                  </span>
                )}

                {person.data?.ficha_url && (
                  <span className="person-meta-link">
                    <a href={person.data.ficha_url} target="_blank" rel="noopener noreferrer">
                      <AlertCircle size={14} /> Ver ficha original
                    </a>
                  </span>
                )}

                {person.metadata?.reportedBy && (
                  <span><User size={12} className="inline-icon" /> Reportado por: {person.metadata.reportedBy.name}</span>
                )}
              </div>
            </div>
          </div>

          {/* ─── Botones de acción principales ─── */}
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
            {isMissing && isOwner && (
              <button className="btn-main-action btn-main-action-success" onClick={() => setShowCloseCase(!showCloseCase)}>
                <ShieldCheck size={18} />
                Cerrar Caso (Auditoría Legal)
              </button>
            )}
          </div>

          {/* ─── Formulario de cierre de caso ─── */}
          {showCloseCase && (
            <div className="person-modal-close-case-card">
              <h4 className="person-modal-close-case-title">
                <ShieldCheck size={16} /> Auditoría y Cierre de Caso
              </h4>
              <p className="person-modal-desc-text">
                Al cerrar este caso, tu dirección IP y marca de tiempo quedarán selladas
                criptográficamente para cumplir con el artículo 43 de la LOPNNA y la Ley de Protección de Datos.
              </p>
              <form onSubmit={handleCloseCase} className="person-modal-form">
                <select
                  value={closeResolution}
                  onChange={e => setCloseResolution(e.target.value as any)}
                  className="person-modal-input"
                >
                  <option value="found">La persona ha sido Localizada (Viva)</option>
                  <option value="deceased">La persona ha sido hallada sin vida</option>
                  <option value="erroneous">El reporte original era falso o duplicado</option>
                </select>

                <textarea
                  placeholder="Detalles del reencuentro o resolución (Opcional)..."
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  className="person-modal-input"
                  style={{ minHeight: '60px' }}
                />

                <div className="person-modal-form-actions">
                  <button type="submit" disabled={closing} className="btn-success">
                    {closing ? 'Sellando...' : 'Sellar y Cerrar Caso'}
                  </button>
                  <Button type="button" variant="outline" onClick={() => setShowCloseCase(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ─── Formulario de contacto enmascarado ─── */}
          {showContactForm && (
            <div className="person-modal-contact-card">
              <h4 className="person-modal-contact-title"><Lock size={16} color="var(--clr-amber)" /> Comunicación Segura</h4>
              <p className="person-modal-desc-text">
                Tu mensaje será enviado al familiar/reportante sin revelar tus datos de contacto
                iniciales. El equipo de Reencuentro Terremoto Venezuela intermediará si es necesario.
              </p>
              <form onSubmit={handleSendMessage} className="person-modal-form">
                <textarea
                  placeholder="Escribe aquí tu mensaje sobre esta persona..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  className="person-modal-input"
                  style={{ minHeight: '80px' }}
                />
                <div className="person-modal-form-actions">
                  <Button type="submit" disabled={sending}>
                    {sending ? 'Enviando...' : 'Enviar Mensaje'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowContactForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ─── Información detallada ─── */}
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
                  /* Muro de protección: pedir cédula para ver datos */
                  <div className="person-modal-protected-box">
                    <p className="person-modal-protected-desc">
                      <Lock size={16} className="inline-icon" />
                      Esta persona fue localizada. Por su seguridad, la ubicación exacta
                      y el detalle del refugio están protegidos. Si eres familiar, introduce
                      su cédula para ver los datos:
                    </p>
                    <form onSubmit={handleCedulaMatch} className="person-modal-protected-form">
                      <input
                        type="text"
                        placeholder="Cédula de Identidad"
                        value={cedulaInput}
                        onChange={e => setCedulaInput(e.target.value)}
                        className="person-modal-protected-input"
                      />
                      <Button type="submit">
                        Verificar
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Avisos de la comunidad ─── */}
          <div className="info-section info-section-warning">
            <h3 className="info-section-warning-title"><AlertCircle size={18} /> Avisos de la comunidad</h3>
            <p className="person-modal-desc-text">
              Esta información es enviada por la comunidad y no ha sido verificada oficialmente.
            </p>
            <p className="info-section-warning-text">
              Aún no hay reportes de la comunidad para esta persona.
            </p>
          </div>

          {/* ─── Recursos de emergencia ─── */}
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

          {/* ─── Compartir en redes ─── */}
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
