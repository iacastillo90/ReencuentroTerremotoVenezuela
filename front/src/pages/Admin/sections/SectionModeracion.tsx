/**
 * SectionModeracion.tsx — Moderación de reportes manuales
 *
 * PROPÓSITO:
 *   Permite al administrador revisar, editar, aprobar o rechazar
 *   reportes manuales creados por los usuarios. También incluye
 *   un chat para comunicarse con el reportero.
 *
 * FLUJO:
 *   1. Al montar, carga los reportes en estado
 *      'pending_moderation' desde /admin/persons.
 *   2. El admin puede:
 *      - Aprobar: el reporte se vuelve visible en el feed/mapa.
 *      - Rechazar: el reporte se elimina (pide confirmación).
 *      - Editar: abre un drawer con todos los campos editables.
 *      - Chat: abre ChatWidget para hablar con el reportero.
 *   3. Al aprobar o rechazar, la fila se elimina de la tabla
 *      (filter local, sin recargar).
 *
 * SEGURIDAD:
 *   - Al rechazar, se pide confirmación con window.confirm.
 *   - El backend valida que el admin tenga permisos.
 *   - Los datos editados se validan en el backend antes de guardar.
 *
 * CHAT:
 *   El chat usa ChatWidget de components/common. Los mensajes se
 *   cargan de /admin/persons/:idHash/contacts al abrir el chat,
 *   y se envían a /contacts con POST.
 */
import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Edit2, MessageSquare, Users } from 'lucide-react';
import { api } from '../../../services/api';
import { useToast } from '../../../store/ToastContext';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';
import { ChatWidget } from '../../../components/common/ChatWidget';

interface ModeracionPerson {
  idHash: string;
  name: string;
  photoUrl?: string;
  status: string;
  type: string;
  age?: number;
  gender?: string;
  aliases?: string | string[];
  lastSeen?: {
    description?: string;
    state?: string;
    municipality?: string;
    date?: string;
  };
  metadata?: {
    reportedBy?: string | { _id: string; name: string };
    source?: string;
  };
  contactPerson?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

interface ChatMessage {
  _id: string;
  senderId: string;
  receiverId?: string;
  reportId?: string;
  message?: string;
  createdAt?: string;
}

export function SectionModeracion() {
  const { addToast } = useToast();
  const [persons, setPersons] = useState<ModeracionPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // load: obtiene reportes pendientes de moderación.
  // Filtra por auditStatus=pending_moderation.
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/persons?limit=200&auditStatus=pending_moderation');
      setPersons(res.data);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error cargando moderación');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Estado de modales ──────────────────────────────
  const [editingPerson, setEditingPerson] = useState<ModeracionPerson | null>(null);
  const [chattingPerson, setChattingPerson] = useState<ModeracionPerson | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Carga el historial del chat cuando se abre la ventana de chat.
  useEffect(() => {
    if (chattingPerson) {
      const fetchHistory = async () => {
        try {
          setChatLoading(true);
          const res = await api.get(`/admin/persons/${chattingPerson.idHash}/contacts`);
          setChatMessages(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setChatLoading(false);
        }
      };
      fetchHistory();
    }
  }, [chattingPerson]);

  // ─── moderate: aprueba o rechaza un reporte ─────────
  const moderate = async (idHash: string, action: 'approve' | 'reject') => {
    // Confirmación antes de rechazar (acción destructiva).
    if (action === 'reject' && !window.confirm('¿Seguro que deseas RECHAZAR y ELIMINAR este reporte?')) return;
    try {
      await api.patch(`/admin/persons/${idHash}/moderate`, { action });
      // Elimina la fila de la tabla local (sin recargar).
      setPersons(prev => prev.filter(p => p.idHash !== idHash));
    } catch (e: any) {
      addToast(e.response?.data?.error || 'Error al procesar la moderación', 'error');
    }
  };

  // ─── handleEditSubmit: guarda cambios del drawer ────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Construye el payload con los campos editables.
      const payload: Record<string, unknown> = {
        name: editingPerson.name,
        type: editingPerson.type,
        status: editingPerson.status,
        aliases: editingPerson.aliases,
        age: editingPerson.age,
        gender: editingPerson.gender,
        description: editingPerson.lastSeen?.description,
        state: editingPerson.lastSeen?.state,
        municipality: editingPerson.lastSeen?.municipality,
        date: editingPerson.lastSeen?.date
      };

      if (editingPerson.contactPerson) {
        payload.contactPerson = editingPerson.contactPerson;
      }

      // PUT /admin/persons/:idHash → actualiza en backend.
      const updated = await api.put(`/admin/persons/${editingPerson.idHash}`, payload);
      // Actualiza la fila local con los datos devueltos.
      setPersons(prev => prev.map(p =>
        p.idHash === editingPerson.idHash ? { ...p, ...updated.data } : p
      ));
      setEditingPerson(null);
      addToast('Datos actualizados correctamente', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Error al actualizar', 'error');
    }
  };

  // ─── handleSendChat: envía un mensaje en el chat ────
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    try {
      // Extrae el ID del reportero desde metadata.reportedBy
      // (puede ser un string o un objeto { _id, name }.
      const receiver = chattingPerson.metadata.reportedBy;
      const finalReceiverId = typeof receiver === 'object' && receiver !== null
        ? receiver._id : receiver;

      const res = await api.post('/contacts', {
        reportId: chattingPerson.idHash,
        receiverId: finalReceiverId,
        message: chatMessage
      });
      // Agrega el mensaje al historial local.
      setChatMessages(prev => [...prev, res.data]);
      setChatMessage('');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Error al enviar mensaje', 'error');
    }
  };

  if (loading) return <LoadingScreen text="Cargando reportes para moderar..." />;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><ShieldAlert size={18} /> Moderación de Reportes Manuales</h3>
        <span className="admin-badge pending">{persons.length} Pendientes</span>
      </div>
      <p className="admin-text-muted admin-moderacion-hint">
        Verifica que la foto no exponga a menores y que la descripción no contenga números de teléfono o datos privados antes de aprobar.
      </p>

      {errorMsg && <div className="admin-error-text">{errorMsg}</div>}

      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reporte</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {persons.map(p => (
              <tr key={p.idHash}>
                <td>
                  <div className="name-cell">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="Foto" className="admin-photo-sm" />
                    ) : (
                      <div className="person-thumb-placeholder"><Users size={16} /></div>
                    )}
                    <div>
                      <strong className="admin-text-white">{p.name}</strong><br />
                      <small className="admin-text-muted">
                        {p.lastSeen?.state} · {p.age ? `${p.age} años` : ''}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="admin-desc-pre admin-text-muted">
                    {p.lastSeen?.description || 'Sin descripción'}
                  </div>
                </td>
                <td>
                  {/* Botones de acción en dos filas */}
                  <div className="admin-action-stack">
                    <div className="admin-action-row">
                      <button className="btn-found" onClick={() => moderate(p.idHash, 'approve')} title="Aprobar">
                        <CheckCircle size={16} /> Aprobar
                      </button>
                      <button className="btn-dismiss" onClick={() => moderate(p.idHash, 'reject')} title="Rechazar">
                        <XCircle size={16} /> Rechazar
                      </button>
                    </div>
                    <div className="admin-action-row">
                      <button className="btn-secondary" onClick={() => setEditingPerson(p)} title="Editar">
                        <Edit2 size={16} /> Editar
                      </button>
                      {/* Chat deshabilitado si no hay reportero asociado */}
                      <button className="btn-secondary"
                        onClick={() => setChattingPerson(p)} title="Chat con Reportero"
                        disabled={!p.metadata?.reportedBy}>
                        <MessageSquare size={16} /> Chat
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {persons.length === 0 && (
              <tr><td colSpan={3}><EmptyState message="No hay reportes pendientes de moderación" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ Drawer de edición ═══ */}
      {editingPerson && (
        <div className="admin-drawer-overlay" onClick={() => setEditingPerson(null)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <div className="admin-drawer-header">
              <h3>Editar Datos de Registro</h3>
              <button className="admin-drawer-close" onClick={() => setEditingPerson(null)}>&#10005;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="admin-drawer-form">
              <div className="admin-drawer-body admin-drawer-body-top">

                {/* Grid de campos principales */}
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Nombre Completo</label>
                    <input value={editingPerson.name || ''}
                      onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Alias (separados por coma)</label>
                    <input value={Array.isArray(editingPerson.aliases)
                      ? editingPerson.aliases.join(', ') : (editingPerson.aliases || '')}
                      onChange={e => setEditingPerson({...editingPerson, aliases: e.target.value})} />
                  </div>
                  <div className="admin-form-group">
                    <label>Estado del Reporte</label>
                    <select value={editingPerson.status || 'missing'}
                      onChange={e => setEditingPerson({...editingPerson, status: e.target.value})}>
                      <option value="missing">Desaparecido / En Búsqueda</option>
                      <option value="found">Encontrado</option>
                      <option value="deceased">Fallecido</option>
                      <option value="unknown">Desconocido</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Tipo</label>
                    <select value={editingPerson.type || 'person'}
                      onChange={e => setEditingPerson({...editingPerson, type: e.target.value})}>
                      <option value="person">Persona</option>
                      <option value="animal">Mascota / Animal</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Edad</label>
                    <input type="number" value={editingPerson.age || ''}
                      onChange={e => setEditingPerson({
                        ...editingPerson,
                        age: parseInt(e.target.value) || undefined
                      })} />
                  </div>
                  <div className="admin-form-group">
                    <label>Género</label>
                    <select value={editingPerson.gender || 'unknown'}
                      onChange={e => setEditingPerson({...editingPerson, gender: e.target.value})}>
                      <option value="unknown">No especificado</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Descripción larga */}
                <div className="admin-form-group admin-form-group-mt">
                  <label>Descripción / Vestimenta / Señas</label>
                  <textarea rows={3}
                    value={editingPerson.lastSeen?.description || ''}
                    onChange={e => setEditingPerson({
                      ...editingPerson,
                      lastSeen: {...editingPerson.lastSeen, description: e.target.value}
                    })} />
                </div>

                {/* Ubicación */}
                <div className="admin-form-grid admin-form-grid-mt">
                  <div className="admin-form-group">
                    <label>Estado / Región</label>
                    <input value={editingPerson.lastSeen?.state || ''}
                      onChange={e => setEditingPerson({
                        ...editingPerson,
                        lastSeen: {...editingPerson.lastSeen, state: e.target.value}
                      })} />
                  </div>
                  <div className="admin-form-group">
                    <label>Municipio / Ciudad</label>
                    <input value={editingPerson.lastSeen?.municipality || ''}
                      onChange={e => setEditingPerson({
                        ...editingPerson,
                        lastSeen: {...editingPerson.lastSeen, municipality: e.target.value}
                      })} />
                  </div>
                </div>

                {/* Contacto opcional */}
                <div className="admin-form-section">
                  <h4 className="admin-form-section-title">Información de Contacto (Opcional)</h4>
                  <div className="admin-form-grid">
                    <div className="admin-form-group admin-form-grid-full">
                      <label>Nombre del Familiar o Contacto</label>
                      <input value={editingPerson.contactPerson?.name || ''}
                        onChange={e => setEditingPerson({
                          ...editingPerson,
                          contactPerson: {...(editingPerson.contactPerson||{}), name: e.target.value}
                        })} />
                    </div>
                    <div className="admin-form-group">
                      <label>Teléfono</label>
                      <input value={editingPerson.contactPerson?.phone || ''}
                        onChange={e => setEditingPerson({
                          ...editingPerson,
                          contactPerson: {...(editingPerson.contactPerson||{}), phone: e.target.value}
                        })} />
                    </div>
                    <div className="admin-form-group">
                      <label>Parentesco</label>
                      <input value={editingPerson.contactPerson?.relationship || ''}
                        onChange={e => setEditingPerson({
                          ...editingPerson,
                          contactPerson: {...(editingPerson.contactPerson||{}), relationship: e.target.value}
                        })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer del drawer: botones Cancelar / Guardar */}
              <div className="admin-drawer-footer">
                <button type="button" onClick={() => setEditingPerson(null)}
                  className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Chat con el reportero ═══ */}
      {chattingPerson && (
        <ChatWidget
          title="Moderación - Chat con el Reportero"
          subtitle={`Sobre el reporte de ${chattingPerson.name}`}
          messages={chatMessages}
          currentUserId=""  // El admin no tiene un userId fijo aquí
          isSenderFn={(msg) => {
            // Determina si el mensaje es del admin (no del reportero).
            const reportedBy = chattingPerson.metadata.reportedBy;
            const reportedById = typeof reportedBy === 'object' ? reportedBy._id : reportedBy;
            return msg.senderId !== reportedById;
          }}
          replyText={chatMessage}
          onReplyTextChange={setChatMessage}
          onSend={handleSendChat}
          onClose={() => setChattingPerson(null)}
          loading={chatLoading}
          className="admin-chat-modal"
          closeIcon={<XCircle size={20} />}
        />
      )}
    </div>
  );
}
