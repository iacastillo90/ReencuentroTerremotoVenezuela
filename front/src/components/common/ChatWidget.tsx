/**
 * ChatWidget.tsx — Widget de chat bidireccional
 *
 * PROPÓSITO:
 *   Componente de chat en tiempo real con burbujas de mensaje,
 *   usado tanto en ProfilePage (chats de comunidad entre
 *   usuarios) como en AdminDashboard (moderación de reportes).
 *
 * CARACTERÍSTICAS:
 *   - Burbujas diferenciadas: sender a la derecha (azul),
 *     receiver a la izquierda (gris).
 *   - Scroll automático al último mensaje cuando llega uno nuevo.
 *   - Timestamps formateados con toLocaleTimeString.
 *   - Input con envío por Enter o botón.
 *   - Estados de carga (loading) y vacío (sin mensajes).
 *   - Cierre al hacer click en el overlay (backdrop).
 *
 * FLUJO DE DATOS:
 *   Los mensajes (ChatMessage[]) vienen del padre vía props.
 *   El padre también maneja el envío (onSend) y el texto del input
 *   (replyText, onReplyTextChange). Este componente es puramente
 *   de presentación — no maneja estado de mensajes ni conexión
 *   websocket.
 *
 * CÓMO USAR:
 *   <ChatWidget
 *     title="Chat con Familiar"
 *     subtitle="Juan Pérez"
 *     messages={messages}
 *     currentUserId={user._id}
 *     replyText={replyText}
 *     onReplyTextChange={setReplyText}
 *     onSend={handleSend}
 *     onClose={() => setChatOpen(false)}
 *     loading={loading}
 *   />
 */
import React, { useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { sanitize } from '../../lib/sanitize';

interface ChatMessage {
  _id: string;
  message: string;
  senderId: string;
  createdAt: string;
  isRead?: boolean;
}

interface ChatWidgetProps {
  title: string;
  subtitle?: string;
  messages: ChatMessage[];
  currentUserId: string;
  isSenderFn?: (msg: ChatMessage) => boolean;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onSend: (e: React.FormEvent) => void;
  onClose: () => void;
  loading?: boolean;
  className?: string;
  closeIcon?: React.ReactNode;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  title,
  subtitle,
  messages,
  currentUserId,
  isSenderFn,
  replyText,
  onReplyTextChange,
  onSend,
  onClose,
  loading,
  className = '',
  closeIcon = <X size={20} />,
}) => {
  // Ref al último mensaje para hacer scroll automático.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useEffect: cada vez que messages cambia, hace scroll
  // suave al último mensaje. Comportamiento esperado de
  // cualquier chat (WhatsApp, Messenger, etc.).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Función por defecto para determinar si un mensaje es del sender.
  // Compara el senderId del mensaje con el currentUserId.
  const defaultIsSender = (msg: ChatMessage) => msg.senderId === currentUserId;

  return (
    // Overlay que captura clicks fuera del chat para cerrarlo.
    <div className="chat-modal-overlay" onClick={onClose}>
      {/* El contenido del chat. stopPropagation evita que
          el click dentro del contenido cierre el chat. */}
      <div className={`chat-modal-content ${className}`} onClick={e => e.stopPropagation()}>

        {/* ─── Header ─────────────────────────── */}
        <div className="chat-header">
          <div className="chat-header-info">
            <h4>{title}</h4>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="Cerrar chat">
            {closeIcon}
          </button>
        </div>

        {/* ─── Área de mensajes ──────────────── */}
        <div className="chat-messages-area">
          {loading ? (
            // Estado de carga: spinner mientras se obtienen mensajes.
            <div className="admin-loading">
              <Loader2 className="spinner" size={20} /> Cargando historial...
            </div>
          ) : messages.length === 0 ? (
            // Estado vacío: no hay mensajes en esta conversación.
            <div className="admin-table-empty">
              <p>No hay mensajes aún. Inicia la conversación.</p>
            </div>
          ) : (
            // Lista de mensajes, cada uno en su burbuja.
            messages.map((msg) => {
              const isSender = (isSenderFn || defaultIsSender)(msg);
              return (
                <div key={msg._id}
                  className={`chat-bubble-container ${isSender ? 'sender' : 'receiver'}`}>
                  <div className="chat-bubble">
                    {sanitize(msg.message)}
                    {/* Timestamp: hora local sin segundos */}
                    <time className="chat-time"
                      dateTime={msg.createdAt}
                      aria-label={new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </time>
                  </div>
                </div>
              );
            })
          )}
          {/* Elemento fantasma para el scroll automático */}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── Input de envío ─────────────────── */}
        <form className="chat-input-area" onSubmit={onSend}>
          <input
            type="text"
            className="chat-input"
            placeholder="Escribe un mensaje..."
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            required
            aria-label="Escribir mensaje de chat"
          />
          {/* Botón deshabilitado si el input está vacío */}
          <button type="submit" className="chat-send-btn" disabled={!replyText.trim()} aria-label="Enviar mensaje">
            <Send size={18} />
          </button>
        </form>

      </div>
    </div>
  );
};
