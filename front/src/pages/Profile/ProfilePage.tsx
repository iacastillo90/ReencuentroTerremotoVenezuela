import { useEffect, useState, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { AxiosError } from 'axios';
import { useAuth } from '../../store/AuthContext';
import { useSocket } from '../../store/SocketContext';
import { useToast } from '../../store/ToastContext';
import { api } from '../../services/api';

import type { Person } from '../../types';
import {
  User, Mail, Phone, MapPin, LogOut,
  ShieldAlert, CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ChatWidget } from '../../components/common/ChatWidget';
import { TabReports } from './tabs/TabReports';
import { TabMatches } from './tabs/TabMatches';
import { TabChats } from './tabs/TabChats';
import './Profile.css';

interface ChatMessage {
  _id: string;
  senderId: string;
  receiverId?: string;
  reportId: string;
  message: string;
  createdAt: string;
}

interface MatchItem {
  _id: string;
  matchScore?: number;
  matchedPerson?: Partial<Person>;
  originalReportName?: string;
  status?: string;
}

interface ConversationGroup {
  reportId: string;
  otherUserId: string;
  lastMessage: ChatMessage;
  messages: ChatMessage[];
}

interface ProfilePageProps {
  onSelectPerson: (p: Person) => void;
}

type ProfileTab = 'reports' | 'matches' | 'chats';

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectPerson }) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();

  // ─── Estado de datos ────────────────────────────────
  const [myReports, setMyReports] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<ChatMessage[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [myMatches, setMyMatches] = useState<MatchItem[]>([]);

  const mountedRef = useRef(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('reports');
  const [activeConversation, setActiveConversation] = useState<{
    reportId: string; otherUserId: string
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const fetchGenRef = useRef(0);

  // ─── handleRequestVerification ─────────────────────
  // Envía una solicitud para ser verificador.
  // POST /auth/verification-request con las notas del usuario.
  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/verification-request', { notes: requestNotes });
      addToast('Solicitud enviada correctamente. Un moderador la revisará pronto.', 'success');
      setShowRequestForm(false);
    } catch (err) {
      const axErr = err as { response?: { data?: { error?: string } } };
      addToast(axErr.response?.data?.error || 'Error al enviar la solicitud', 'error');
    }
  };

  // Obtiene en paralelo:
  //   - /persons/mine: reportes del usuario.
  //   - /contacts/received: mensajes recibidos.
  //   - /contacts/sent: mensajes enviados.
  const fetchData = async () => {
    try {
      const [res, msgs, sent] = await Promise.all([
        api.get<Person[]>('/persons/mine'),
        api.get('/contacts/received'),
        api.get('/contacts/sent'),
      ]);
      if (!mountedRef.current) {
        return;
      }
      // El backend de /persons/mine devuelve { data, total, limit, offset } o a veces un array directo si cambia.
      const reportsData = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      setMyReports(reportsData);
      const messagesData = Array.isArray(msgs.data) ? msgs.data : (msgs.data as any)?.data || [];
      const sentData = Array.isArray(sent.data) ? sent.data : (sent.data as any)?.data || [];
      setMessages(messagesData);
      setSentMessages(sentData);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Error fetching data', err);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (user) fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  // ─── fetchMatches: obtiene coincidencias de IA ─────
  // Recorre cada reporte del usuario y pide /matches/:idHash.
  // Acumula todos los resultados en myMatches[].
  useEffect(() => {
    const fetchMatches = async () => {
      const gen = ++fetchGenRef.current;
      if (myReports.length > 0) {
        try {
          const allMatches: MatchItem[] = [];
          for (let i = 0; i < myReports.length; i += 5) {
            const batch = myReports.slice(i, i + 5);
            const results = await Promise.allSettled(
              batch.map(report =>
                api.get(`/matches/${report.idHash}`)
                  .then(matchRes => ({ report, data: matchRes.data || [] }))
              )
            );
            if (fetchGenRef.current !== gen) return;
            for (const result of results) {
              if (result.status === 'fulfilled') {
                const { report, data } = result.value;
                if (data.length > 0) {
                  allMatches.push(
                    ...data.map((m: MatchItem) => ({
                      ...m,
                      originalReportName: report.name
                    }))
                  );
                }
              }
            }
          }
          if (fetchGenRef.current !== gen) return;
          setMyMatches(allMatches);
        } catch (err) {
          if (fetchGenRef.current !== gen) return;
          console.debug('Error fetching matches', err);
        }
      }
    };
    fetchMatches();
  }, [myReports]);

  // ─── Socket: escuchar mensajes en tiempo real ──────
  // Cuando llega un mensaje nuevo via websocket, lo agrega
  // al inicio de messages[] (si no está duplicado).
  useEffect(() => {
    if (!socket) return;
    const handleReceiveMessage = (msg: ChatMessage) => {
      setMessages(prev =>
        prev.some(m => m._id === msg._id) ? prev : [msg, ...prev]
      );
    };
    socket.on('receive_message', handleReceiveMessage);
    return () => { socket.off('receive_message', handleReceiveMessage); };
  }, [socket]);

  // ─── Acciones de match ─────────────────────────────
  // handleRequestMediation: pide una sala de mediación para menores.
  // handleStartDirectChat: pide una sala de chat directo.
  const handleRequestMediation = (match: MatchItem) => {
    if (!socket) {
      addToast('Desconectado del servidor de chat', 'error');
      return;
    }
    socket.emit('request_match_chat', { matchId: match._id });
    addToast('Se ha solicitado la sala de mediación. Un moderador se unirá pronto.', 'success');
  };

  const handleStartDirectChat = (match: MatchItem) => {
    if (!socket) {
      addToast('Desconectado del servidor de chat', 'error');
      return;
    }
    socket.emit('request_match_chat', { matchId: match._id });
    addToast('Sala de chat directo solicitada.', 'info');
  };

  // ─── handleSendMessage: enviar mensaje ──────────────
  // POST /contacts con reportId, receiverId y message.
  // Agrega el mensaje a sentMessages[] localmente.
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConversation) return;
    try {
      const res = await api.post('/contacts', {
        reportId: activeConversation.reportId,
        receiverId: activeConversation.otherUserId,
        message: replyText,
      });
      setSentMessages(prev => [...prev, res.data]);
      setReplyText('');
    } catch (err) {
      const axiosErr = err as AxiosError<{error: string}>;
      addToast(axiosErr.response?.data?.error || 'Error al enviar mensaje', 'error');
    }
  };

  // ─── Guard: usuario no logueado ─────────────────────
  if (!user) {
    return (
      <div className="profile-page flex-center">
        <p>Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  // ─── Procesamiento de mensajes ──────────────────────
  // Combina mensajes recibidos y enviados, deduplicando por _id.
  const uniqueMessagesMap = new Map();
  [...messages, ...sentMessages].forEach(msg =>
    uniqueMessagesMap.set(msg._id, msg)
  );
  const allMessages = Array.from(uniqueMessagesMap.values()).sort(
    (a: ChatMessage, b: ChatMessage) =>
      new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime()
  );

  // Agrupa mensajes por conversación (reportId + otherUserId).
  const conversationsMap = new Map<string, ConversationGroup>();
  allMessages.forEach((msg: ChatMessage) => {
    const isSender = msg.senderId === user._id;
    const otherUserId = isSender ? msg.receiverId : msg.senderId;
    if (!otherUserId) return;
    const key = `${msg.reportId}_${otherUserId}`;
    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        reportId: msg.reportId, otherUserId,
        lastMessage: msg, messages: []
      });
    }
    conversationsMap.get(key)!.messages.push(msg);
    conversationsMap.get(key)!.lastMessage = msg;
  });

  // Ordena conversaciones por fecha del último mensaje (más reciente primero).
  const conversationList = Array.from(conversationsMap.values()).sort(
    (a, b) =>
      new Date(b.lastMessage.createdAt || '').getTime() -
      new Date(a.lastMessage.createdAt || '').getTime()
  );

  // Filtra mensajes del hilo activo (reportId + otherUserId).
  const activeThreadMessages = activeConversation
    ? allMessages.filter(
        (msg: ChatMessage) =>
          msg.reportId === activeConversation.reportId &&
          ((msg.senderId === user._id &&
            msg.receiverId === activeConversation.otherUserId) ||
            (msg.senderId === activeConversation.otherUserId &&
              msg.receiverId === user._id))
      )
    : [];

  // ─── Configuración de tabs ─────────────────────────
  const TAB_LABELS: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'reports', label: `Mis Reportes (${myReports.length})` },
    { key: 'matches', label: 'Posibles Coincidencias', count: myMatches.length },
    { key: 'chats', label: `Conversaciones (${conversationList.length})` },
  ];

  return (
    <div className="profile-page">
      {/* ═══ Header del perfil ═══ */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          <User size={48} color="var(--clr-primary)" />
        </div>
        <h2>{user.name}</h2>
        <div className="profile-contact-info">
          <span><Mail size={14} /> {user.email}</span>
          {user.contactNumber && (
            <span><Phone size={14} /> {user.contactNumber}</span>
          )}
          {user.sector && (
            <span><MapPin size={14} /> {user.sector}</span>
          )}
        </div>
        <button className="btn-logout" onClick={logout}>
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>

      {/* ═══ Card de rol: user → puede solicitar verificación ═══ */}
      {user.role === 'user' && (
        <div className="profile-content profile-role-card profile-role-user">
          <h3 className="profile-role-title">
            <ShieldAlert size={20} /> Solicitar Acceso de Verificador
          </h3>
          <p className="profile-role-desc">
            Si eres periodista, miembro de ONG o personal en terreno,
            puedes solicitar acceso a datos de refugios e información
            de contacto directo de los desaparecidos encontrados.
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
                aria-label="Notas de solicitud de verificación"
                className="profile-textarea"
              />
              <div className="profile-form-actions">
                <Button type="submit">Enviar Solicitud</Button>
                <Button type="button" variant="outline"
                  onClick={() => setShowRequestForm(false)}>Cancelar</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ═══ Card de verificación aprobada ═══ */}
      {user.role === 'verifier' && (
        <div className="profile-content profile-role-card profile-role-verifier">
          <h3 className="profile-role-title-success">
            <CheckCircle size={20} /> Cuenta Verificada (Periodista / ONG)
          </h3>
          <p className="profile-role-desc">
            Tienes acceso completo a la información de contacto y
            ubicaciones exactas para facilitar reencuentros seguros.
          </p>
        </div>
      )}

      {/* ═══ Tabs ═══ */}
      <div className="profile-tabs">
        {TAB_LABELS.map(({ key, label, count }) => (
          <button key={key}
            className={`profile-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}>
            {label}
            {count !== undefined && count > 0 && (
              <span className="profile-tab-badge">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido de tabs */}
      {activeTab === 'reports' && (
        <TabReports myReports={myReports} loading={loading}
          onSelectPerson={onSelectPerson} />
      )}
      {activeTab === 'matches' && (
        <TabMatches myMatches={myMatches} loading={loading}
          handleRequestMediation={handleRequestMediation}
          handleStartDirectChat={handleStartDirectChat} />
      )}
      {activeTab === 'chats' && (
        <TabChats conversationList={conversationList}
          onSelectConversation={(reportId, otherUserId) =>
            setActiveConversation({ reportId, otherUserId })} />
      )}

      {/* ═══ ChatWidget (modal) ═══ */}
      {activeConversation && (
        <ChatWidget
          title="Conversación sobre el reporte"
          subtitle={`ID Reporte: ${activeConversation.reportId}`}
          messages={activeThreadMessages}
          currentUserId={user._id}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onSend={handleSendMessage}
          onClose={() => setActiveConversation(null)}
        />
      )}
    </div>
  );
};

export default Sentry.withErrorBoundary(ProfilePage, {
  fallback: <div className="error-boundary-fallback">Ocurrió un error al cargar el perfil.</div>
});
