/**
 * TabChats.tsx — Lista de conversaciones del usuario
 *
 * PROPÓSITO:
 *   Muestra las conversaciones activas del usuario, agrupadas
 *   por reportId + otherUserId. Cada conversación es una card
 *   que muestra:
 *   - reportId (caso al que pertenece).
 *   - Badge: "Nuevos" si hay mensajes no leídos, "Activo" si no.
 *   - Último mensaje y fecha.
 *   - Click → abre ChatWidget en el padre (ProfilePage).
 *
 * FILTRADO DE NO LEÍDOS:
 *   Se considera "no leído" si el mensaje tiene isRead=false
 *   y el sender no es el usuario actual.
 *
 * NOTA:
 *   El orden de las conversaciones lo determina ProfilePage
 *   (conversationList ya viene ordenado por fecha descendente).
 */
import { MessageCircle, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../store/AuthContext';

interface Props {
  conversationList: any[];
  onSelectConversation: (reportId: string, otherUserId: string) => void;
}

export function TabChats({ conversationList, onSelectConversation }: Props) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="profile-content">
      <h3>
        <MessageCircle size={18} /> Conversaciones de la Comunidad ({conversationList.length})
      </h3>

      {conversationList.length === 0 ? (
        <div className="profile-empty">
          <p>No tienes mensajes ni conversaciones activas.</p>
        </div>
      ) : (
        <div className="my-reports-list">
          {conversationList.map(conv => (
            <div key={`${conv.reportId}_${conv.otherUserId}`}
              className="report-card report-card-message"
              onClick={() => onSelectConversation(conv.reportId, conv.otherUserId)}>
              {/* Header: reportId + badge de estado */}
              <div className="report-card-header">
                <h4>Caso: {conv.reportId}</h4>
                <span className="status-badge found">
                  {conv.messages.filter(
                    (m: any) => !m.isRead && m.senderId !== user._id
                  ).length > 0 ? 'Nuevos' : 'Activo'}
                </span>
              </div>

              {/* Body: último mensaje y fecha */}
              <div className="report-card-body">
                <p>
                  <Clock size={12} /> Último mensaje:{' '}
                  {new Date(conv.lastMessage.createdAt).toLocaleDateString('es-VE')}
                </p>
                <p className="report-desc report-message-text">
                  &quot;{conv.lastMessage.message}&quot;
                </p>
              </div>

              {/* Footer: call to action */}
              <div className="report-card-footer">
                <span>Abrir Chat <ArrowRight size={14} /></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
