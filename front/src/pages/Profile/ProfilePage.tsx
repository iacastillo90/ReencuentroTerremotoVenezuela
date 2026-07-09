import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useSocket } from '../../store/SocketContext';
import { api } from '../../services/api';
import type { Person } from '../../types';
import {
  User, Mail, Phone, MapPin, Clock, ArrowRight, LogOut,
  FileText, ShieldAlert, CheckCircle, MessageCircle, Send, X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './Profile.css';

interface ProfilePageProps {
  onSelectPerson: (p: Person) => void;
}

interface ActiveConversation {
  reportId: string;
  otherUserId: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectPerson }) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  
  const [myReports, setMyReports] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Chat states
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/verification-request', { notes: requestNotes });
      alert('Solicitud enviada correctamente. Un moderador la revisará pronto.');
      setShowRequestForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al enviar la solicitud');
    }
  };

  const fetchData = async () => {
    try {
      const res = await api.get<Person[]>('/persons/mine');
      setMyReports(res.data);
      const msgs = await api.get('/contacts/received');
      setMessages(msgs.data);
      const sent = await api.get('/contacts/sent');
      setSentMessages(sent.data);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Real-time socket message handler
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: any) => {
      console.log('[ProfilePage] New real-time message received via socket:', msg);
      // Append to incoming messages if not already present
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [msg, ...prev];
      });
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (activeConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation, messages, sentMessages]);

  if (!user) {
    return (
      <div className="profile-page flex-center">
        <p>Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  // Combine and sort all messages chronologically
  const allMessages = [...messages, ...sentMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Group messages into conversations (threads)
  // key: reportId_otherUserId
  const conversationsMap = new Map<string, any>();
  
  // Go through all messages to build unique conversation threads
  allMessages.forEach(msg => {
    const isSender = msg.senderId === user._id;
    const otherUserId = isSender ? msg.receiverId : msg.senderId;
    if (!otherUserId) return; // Ignore if no other party
    
    const key = `${msg.reportId}_${otherUserId}`;
    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        reportId: msg.reportId,
        otherUserId: otherUserId,
        lastMessage: msg,
        messages: [],
      });
    }
    conversationsMap.get(key).messages.push(msg);
    conversationsMap.get(key).lastMessage = msg;
  });

  const conversationList = Array.from(conversationsMap.values()).sort(
    (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
  );

  // Get active thread messages
  const activeThreadMessages = activeConversation
    ? allMessages.filter(
        msg =>
          msg.reportId === activeConversation.reportId &&
          ((msg.senderId === user._id && msg.receiverId === activeConversation.otherUserId) ||
            (msg.senderId === activeConversation.otherUserId && msg.receiverId === user._id))
      )
    : [];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConversation) return;

    try {
      const res = await api.post('/contacts', {
        reportId: activeConversation.reportId,
        receiverId: activeConversation.otherUserId,
        message: replyText,
      });

      // Add to local state immediately
      setSentMessages(prev => [...prev, res.data]);
      setReplyText('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al enviar mensaje');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-large">
          <User size={48} color="var(--clr-primary)" />
        </div>
        <h2>{user.name}</h2>
        <div className="profile-contact-info">
          <span><Mail size={14} /> {user.email}</span>
          {user.contactNumber && <span><Phone size={14} /> {user.contactNumber}</span>}
          {user.sector && <span><MapPin size={14} /> {user.sector}</span>}
        </div>
        
        <button className="btn-logout" onClick={logout}>
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>

      {user.role === 'user' && (
        <div className="profile-content profile-role-card profile-role-user">
          <h3 className="profile-role-title">
            <ShieldAlert size={20} /> Solicitar Acceso de Verificador
          </h3>
          <p className="profile-role-desc">
            Si eres periodista, miembro de ONG o personal en terreno, puedes solicitar acceso a datos de refugios e información de contacto directo de los desaparecidos encontrados.
          </p>
          {!showRequestForm ? (
            <Button onClick={() => setShowRequestForm(true)}>
              Solicitar Rol
            </Button>
          ) : (
            <form onSubmit={handleRequestVerification} className="profile-request-form">
              <textarea 
                placeholder="Explica brevemente tu rol y organización para validar tu acceso..."
                value={requestNotes}
                onChange={e => setRequestNotes(e.target.value)}
                required
                className="profile-textarea"
              />
              <div className="profile-form-actions">
                <Button type="submit">
                  Enviar Solicitud
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {user.role === 'verifier' && (
        <div className="profile-content profile-role-card profile-role-verifier">
          <h3 className="profile-role-title-success">
            <CheckCircle size={20} /> Cuenta Verificada (Periodista / ONG)
          </h3>
          <p className="profile-role-desc">
            Tienes acceso completo a la información de contacto y ubicaciones exactas para facilitar reencuentros seguros.
          </p>
        </div>
      )}

      {/* Real-time Chats / Messages List */}
      <div className="profile-content">
        <h3><MessageCircle size={18} /> Conversaciones de la Comunidad ({conversationList.length})</h3>
        {conversationList.length === 0 ? (
          <div className="profile-empty">
            <p>No tienes mensajes ni conversaciones activas.</p>
          </div>
        ) : (
          <div className="my-reports-list">
            {conversationList.map(conv => (
              <div
                key={`${conv.reportId}_${conv.otherUserId}`}
                className="report-card report-card-message"
                onClick={() => setActiveConversation({ reportId: conv.reportId, otherUserId: conv.otherUserId })}
              >
                <div className="report-card-header">
                  <h4>Caso: {conv.reportId}</h4>
                  <span className={`status-badge found`}>
                    {conv.messages.filter((m: any) => !m.isRead && m.senderId !== user._id).length > 0
                      ? 'Nuevos'
                      : 'Activo'}
                  </span>
                </div>
                <div className="report-card-body">
                  <p><Clock size={12} /> Último mensaje: {new Date(conv.lastMessage.createdAt).toLocaleDateString('es-VE')}</p>
                  <p className="report-desc report-message-text">
                    "{conv.lastMessage.message}"
                  </p>
                </div>
                <div className="report-card-footer">
                  <span>Abrir Chat <ArrowRight size={14} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-content">
        <h3><FileText size={18} /> Mis reportes ({myReports.length})</h3>
        
        {loading ? (
          <div className="profile-loading">Cargando reportes...</div>
        ) : myReports.length === 0 ? (
          <div className="profile-empty">
            <p>Aún no has creado ningún reporte.</p>
          </div>
        ) : (
          <div className="my-reports-list">
            {myReports.map(person => (
              <div key={person.idHash} className="report-card" onClick={() => onSelectPerson(person)}>
                <div className="report-card-header">
                  <h4>{person.name}</h4>
                  <span className={`status-badge ${person.status === 'missing' ? 'missing' : 'found'}`}>
                    {person.status === 'missing' ? 'En búsqueda' : 'Encontrado'}
                  </span>
                </div>
                <div className="report-card-body">
                  <p><Clock size={12} /> Actualizado: {new Date(person.metadata.createdAt || '').toLocaleDateString('es-VE')}</p>
                  <p className="report-desc">{person.lastSeen?.description || person.description}</p>
                </div>
                <div className="report-card-footer">
                  <span>Ver detalles <ArrowRight size={14} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time 2-way Chat Modal Overlay */}
      {activeConversation && (
        <div className="chat-modal-overlay" onClick={() => setActiveConversation(null)}>
          <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <div className="chat-header-info">
                <h4>Conversación sobre el reporte</h4>
                <p>ID Reporte: {activeConversation.reportId}</p>
              </div>
              <button className="chat-close-btn" onClick={() => setActiveConversation(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="chat-messages-area">
              {activeThreadMessages.map(msg => {
                const isSender = msg.senderId === user._id;
                return (
                  <div
                    key={msg._id}
                    className={`chat-bubble-container ${isSender ? 'sender' : 'receiver'}`}
                  >
                    <div className="chat-bubble">
                      {msg.message}
                      <span className="chat-time">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <form onSubmit={handleSendMessage} className="chat-form">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Escribe un mensaje de respuesta..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  required
                />
                <button type="submit" className="chat-send-btn">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
