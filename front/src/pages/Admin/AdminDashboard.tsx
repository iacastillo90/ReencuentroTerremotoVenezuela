import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, GitMerge, ShieldCheck,
  ArrowLeft, Search, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight, User, ShieldAlert, Edit2, MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import './AdminDashboard.css';
import '../Profile/Profile.css'; // Reutilizar estilos del Chat Tipo WhatsApp

interface PersonRow {
  _id: string;
  name: string;
  status: string;
  photoUrl?: string;
  age?: number;
  'lastSeen.state'?: string;
  lastSeen?: { state: string; description: string };
  'metadata.urgencyScore'?: number;
  'metadata.auditStatus'?: string;
  'metadata.source'?: string;
  metadata?: { urgencyScore: number; auditStatus: string; source: string };
  data?: { cedula?: string };
  idHash: string;
}

interface AuditJob {
  jobId: string;
  incoming: any;
  candidates: any[];
  timestamp: number;
}

interface AdminDashboardProps {
  onBack: () => void;
}

// ── Sección: Resumen ─────────────────────────────────────────
function SectionResumen({ counts }: { counts: any }) {
  if (!counts) return null;

  return (
    <div className="admin-stats-row">
      <div className="admin-stat-card">
        <div className="admin-stat-icon red"><Users size={22} /></div>
        <div><h4>{(counts.missing || 0).toLocaleString()}</h4><p>Personas Desaparecidas</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon green"><CheckCircle size={22} /></div>
        <div><h4>{(counts.found || 0).toLocaleString()}</h4><p>Personas Encontradas</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon amber"><AlertTriangle size={22} /></div>
        <div><h4>{(counts.pending || 0).toLocaleString()}</h4><p>Pendientes de Revisión</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon blue"><GitMerge size={22} /></div>
        <div><h4>{(counts.manual || 0).toLocaleString()}</h4><p>Reportes Manuales (IA)</p></div>
      </div>
    </div>
  );
}

// ── Sección: Todos los Registros ─────────────────────────────
function SectionRegistros({ persons, loading, onStatusChange }: {
  persons: PersonRow[];
  loading: boolean;
  onStatusChange: (idHash: string, newStatus: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = persons.filter(p =>
    !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const changeStatus = async (idHash: string, newStatus: string) => {
    try {
      await api.patch(`/admin/persons/${idHash}/status`, { status: newStatus });
      onStatusChange(idHash, newStatus);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error actualizando estado');
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><ShieldCheck size={18} /> Control de Registros</h3>
        <div className="admin-search-bar">
          <Search size={16} color="#475569" />
          <input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando registros...</span></div>
      ) : (
        <div className="table-responsive-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estado</th>
                <th>Fuente</th>
                <th>Auditoría IA</th>
                <th>Urgencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(p => {
                const status = p.status;
                const auditStatus = p['metadata.auditStatus'] || p.metadata?.auditStatus;
                const source = p['metadata.source'] || p.metadata?.source;
                const urgency = p['metadata.urgencyScore'] ?? p.metadata?.urgencyScore ?? 0;
                const state = p.lastSeen?.state || p['lastSeen.state'] || '—';

                return (
                  <tr key={p.idHash}>
                    <td>
                      <div className="name-cell">
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} className="person-thumb" />
                          : <div className="person-thumb-placeholder"><Users size={16} /></div>
                        }
                        <div>
                          <strong className="admin-text-white">{p.name}</strong><br />
                          <small className="admin-text-muted">{state}{p.age ? ` · ${p.age} años` : ''}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${status}`}>
                        {status === 'missing' ? 'Desaparecido' : status === 'found' ? 'Encontrado' : status}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${source === 'manual' ? 'manual' : 'api'}`}>
                        {source === 'manual' ? 'Reporte manual' : source || 'API'}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${auditStatus === 'pending_review' ? 'pending' : auditStatus === 'merged' ? 'found' : 'api'}`}>
                        {auditStatus === 'pending_review' ? 'Revisión' : auditStatus === 'merged' ? 'Fusionado' : 'Limpio'}
                      </span>
                    </td>
                    <td>
                      <span className={urgency > 70 ? 'admin-urgency-high' : urgency > 40 ? 'admin-urgency-medium' : 'admin-urgency-low'}>
                        {urgency}/100
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {status === 'missing' && (
                          <button className="btn-found" onClick={() => changeStatus(p.idHash, 'found')}>
                            <CheckCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                            Encontrado
                          </button>
                        )}
                        {status === 'found' && (
                          <button className="btn-dismiss" onClick={() => changeStatus(p.idHash, 'missing')}>
                            <XCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr key="empty-state"><td colSpan={6} className="admin-table-empty">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sección: Búsquedas Activas (Familiares) ───────────────────
function SectionBusquedas() {
  const [searches, setSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/searches');
      setSearches(res.data);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error cargando búsquedas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando búsquedas...</span></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><Search size={18} /> Solicitudes de Búsqueda (Familiares)</h3>
        <span className="admin-badge pending">{searches.filter(s => s.status === 'activa').length} Activas</span>
      </div>

      {errorMsg && <div style={{ color: 'var(--clr-danger)', marginBottom: '1rem' }}>{errorMsg}</div>}

      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Persona Buscada</th>
              <th>Descripción</th>
              <th>Familiar / Contacto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {searches.map(s => (
              <tr key={s._id}>
                <td>
                  <div className="name-cell">
                    <div className="person-thumb-placeholder"><Users size={16} /></div>
                    <div>
                      <strong className="admin-text-white">{s.searchName}</strong><br />
                      <small className="admin-text-muted">{s.category || 'General'}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>
                    {s.description || 'Sin descripción detallada'}
                  </div>
                </td>
                <td>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{s.user?.name || 'Desconocido'}</strong>
                    <div className="admin-text-muted" style={{ fontSize: '0.8rem' }}>{s.user?.email || 'Sin email'}</div>
                  </div>
                </td>
                <td>
                  <span className={`admin-badge ${s.status === 'activa' ? 'pending' : s.status === 'resuelta' ? 'found' : 'missing'}`}>
                    {s.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
            {searches.length === 0 && (
              <tr key="empty-state"><td colSpan={4} className="admin-table-empty">No hay búsquedas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sección: Moderación de Nuevos Reportes ───────────────────
function SectionModeracion() {
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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

  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [chattingPerson, setChattingPerson] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chattingPerson) {
      const fetchHistory = async () => {
        try {
          setChatLoading(true);
          const res = await api.get(`/admin/persons/${chattingPerson.idHash}/contacts`);
          setChatMessages(res.data);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } catch (e) {
          console.error(e);
        } finally {
          setChatLoading(false);
        }
      };
      fetchHistory();
    }
  }, [chattingPerson]);

  const moderate = async (idHash: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm('¿Seguro que deseas RECHAZAR y ELIMINAR este reporte?')) return;
    try {
      await api.patch(`/admin/persons/${idHash}/moderate`, { action });
      setPersons(prev => prev.filter(p => p.idHash !== idHash));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al procesar la moderación');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
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

      const updated = await api.put(`/admin/persons/${editingPerson.idHash}`, payload);
      setPersons(prev => prev.map(p => p.idHash === editingPerson.idHash ? { ...p, ...updated.data } : p));
      setEditingPerson(null);
      alert('Datos actualizados correctamente');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    try {
      const receiver = chattingPerson.metadata.reportedBy;
      const finalReceiverId = typeof receiver === 'object' && receiver !== null ? receiver._id : receiver;

      const res = await api.post('/contacts', {
        reportId: chattingPerson.idHash,
        receiverId: finalReceiverId,
        message: chatMessage
      });
      // Añadir al historial local de inmediato
      setChatMessages(prev => [...prev, res.data]);
      setChatMessage('');
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al enviar mensaje');
    }
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando reportes para moderar...</span></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><ShieldAlert size={18} /> Moderación de Reportes Manuales</h3>
        <span className="admin-badge pending">{persons.length} Pendientes</span>
      </div>
      <p className="admin-text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        Verifica que la foto no exponga a menores y que la descripción no contenga números de teléfono o datos privados antes de aprobar.
      </p>

      {errorMsg && <div style={{ color: 'var(--clr-danger)', marginBottom: '1rem' }}>{errorMsg}</div>}

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
                      <img src={p.photoUrl} alt="Foto" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} />
                    ) : (
                      <div className="person-thumb-placeholder"><Users size={16} /></div>
                    )}
                    <div>
                      <strong className="admin-text-white">{p.name}</strong><br />
                      <small className="admin-text-muted">{p.lastSeen?.state} · {p.age ? `${p.age} años` : ''}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ maxWidth: '400px', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }} className="admin-text-muted">
                    {p.lastSeen?.description || 'Sin descripción'}
                  </div>
                </td>
                <td>
                  <div className="action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-found" onClick={() => moderate(p.idHash, 'approve')} title="Aprobar">
                        <CheckCircle size={16} /> Aprobar
                      </button>
                      <button className="btn-dismiss" onClick={() => moderate(p.idHash, 'reject')} title="Rechazar">
                        <XCircle size={16} /> Rechazar
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-secondary" onClick={() => setEditingPerson(p)} title="Editar">
                        <Edit2 size={16} /> Editar
                      </button>
                      <button className="btn-secondary" onClick={() => setChattingPerson(p)} title="Chat con Reportero" disabled={!p.metadata?.reportedBy}>
                        <MessageSquare size={16} /> Chat
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {persons.length === 0 && (
              <tr key="empty-state"><td colSpan={3} className="admin-table-empty">No hay reportes pendientes de moderación</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPerson && (
        <div className="admin-drawer-overlay" onClick={() => setEditingPerson(null)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <div className="admin-drawer-header">
              <h3>Editar Datos de Registro</h3>
              <button className="admin-drawer-close" onClick={() => setEditingPerson(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="admin-drawer-body" style={{ paddingTop: '3rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                  <div className="admin-form-group">
                    <label>Nombre Completo</label>
                    <input value={editingPerson.name || ''} onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Alias (separados por coma)</label>
                    <input value={Array.isArray(editingPerson.aliases) ? editingPerson.aliases.join(', ') : (editingPerson.aliases || '')} onChange={e => setEditingPerson({...editingPerson, aliases: e.target.value})} />
                  </div>
                  <div className="admin-form-group">
                    <label>Estado del Reporte</label>
                    <select 
                      value={editingPerson.status || 'missing'} 
                      onChange={e => setEditingPerson({...editingPerson, status: e.target.value})}
                    >
                      <option value="missing">Desaparecido / En Búsqueda</option>
                      <option value="found">Encontrado</option>
                      <option value="deceased">Fallecido</option>
                      <option value="unknown">Desconocido</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Tipo</label>
                    <select 
                      value={editingPerson.type || 'person'} 
                      onChange={e => setEditingPerson({...editingPerson, type: e.target.value})}
                    >
                      <option value="person">Persona</option>
                      <option value="animal">Mascota / Animal</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Edad</label>
                    <input type="number" value={editingPerson.age || ''} onChange={e => setEditingPerson({...editingPerson, age: parseInt(e.target.value) || undefined})} />
                  </div>
                  <div className="admin-form-group">
                    <label>Género</label>
                    <select 
                      value={editingPerson.gender || 'unknown'} 
                      onChange={e => setEditingPerson({...editingPerson, gender: e.target.value})}
                    >
                      <option value="unknown">No especificado</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group" style={{ marginTop: '1.25rem' }}>
                  <label>Descripción / Vestimenta / Señas</label>
                  <textarea 
                    rows={3} 
                    value={editingPerson.lastSeen?.description || ''} 
                    onChange={e => setEditingPerson({...editingPerson, lastSeen: {...editingPerson.lastSeen, description: e.target.value}})}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                  <div className="admin-form-group">
                    <label>Estado / Región</label>
                    <input value={editingPerson.lastSeen?.state || ''} onChange={e => setEditingPerson({...editingPerson, lastSeen: {...editingPerson.lastSeen, state: e.target.value}})} />
                  </div>
                  <div className="admin-form-group">
                    <label>Municipio / Ciudad</label>
                    <input value={editingPerson.lastSeen?.municipality || ''} onChange={e => setEditingPerson({...editingPerson, lastSeen: {...editingPerson.lastSeen, municipality: e.target.value}})} />
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1.25rem 0', color: '#cbd5e1', fontSize: '1rem' }}>Información de Contacto (Opcional)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                    <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Nombre del Familiar o Contacto</label>
                      <input value={editingPerson.contactPerson?.name || ''} onChange={e => setEditingPerson({...editingPerson, contactPerson: {...(editingPerson.contactPerson||{}), name: e.target.value}})} />
                    </div>
                    <div className="admin-form-group">
                      <label>Teléfono</label>
                      <input value={editingPerson.contactPerson?.phone || ''} onChange={e => setEditingPerson({...editingPerson, contactPerson: {...(editingPerson.contactPerson||{}), phone: e.target.value}})} />
                    </div>
                    <div className="admin-form-group">
                      <label>Parentesco</label>
                      <input value={editingPerson.contactPerson?.relationship || ''} onChange={e => setEditingPerson({...editingPerson, contactPerson: {...(editingPerson.contactPerson||{}), relationship: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-drawer-footer">
                <button type="button" onClick={() => setEditingPerson(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {chattingPerson && (
        <div className="chat-modal-overlay" onClick={() => setChattingPerson(null)}>
          <div className="chat-modal-content admin-chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-header">
              <div className="chat-header-info">
                <h4>Moderación - Chat con el Reportero</h4>
                <p>Sobre el reporte de <strong>{chattingPerson.name}</strong></p>
              </div>
              <button className="chat-close-btn" onClick={() => setChattingPerson(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="chat-messages-area admin-chat-area">
              {chatLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>Cargando historial...</div>
              ) : chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>No hay mensajes aún. Inicia la conversación.</div>
              ) : (
                chatMessages.map(msg => {
                  const isSender = typeof chattingPerson.metadata.reportedBy === 'object' 
                    ? msg.senderId !== chattingPerson.metadata.reportedBy._id
                    : msg.senderId !== chattingPerson.metadata.reportedBy;

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
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSendChat}>
              <input
                type="text"
                placeholder="Escribe un mensaje para solicitar más información..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button type="submit" disabled={!chatMessage.trim()}>
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Merge Modal State
  const [mergingMatch, setMergingMatch] = useState<any>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<any>(null);

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/matches');
      setMatches(res.data);
      setErrorMsg('');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.response?.data?.error || 'Acceso Denegado. Tu sesión actual no tiene los permisos de administrador actualizados en el servidor (el Token expiró o es antiguo). Por favor, Cierra Sesión y vuelve a entrar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const changeStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/matches/${id}/status`, { status: newStatus });
      setMatches(prev => prev.map(m => m._id === id ? { ...m, status: newStatus } : m));
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error actualizando match');
    }
  };

  const handleMergeConfirm = async (id1: string, id2: string) => {
    setIsMerging(true);
    setErrorMsg('');
    try {
      await api.post(`/admin/merge/${id1}/${id2}`);
      setMatches(prev => prev.filter(m => m.person?.idHash !== id2 && m.searchRequestId?._id !== id1));
      setMergingMatch(null);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error al fusionar perfiles');
    } finally {
      setIsMerging(false);
    }
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando coincidencias...</span></div>;

  return (
    <>
    <div className="admin-section">
      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="admin-section-header">
        <h3><GitMerge size={18} /> Casos Pendientes de Fusión (IA)</h3>
        <span className="admin-badge pending">{matches.length} Pendientes</span>
      </div>
      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Alerta (Solicitud)</th>
              <th>Reporte Encontrado</th>
              <th>Similitud</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m._id}>
                <td>
                  {m.searchRequestId ? (
                    <>
                      <strong>Buscado:</strong> {m.searchRequestId.searchName}<br/>
                      <small className="admin-text-secondary">{m.searchRequestId.category}</small>
                    </>
                  ) : m.matchedPerson ? (
                    <div className="name-cell">
                      {m.matchedPerson.photoUrl ? <img src={m.matchedPerson.photoUrl} alt="Foto" className="person-thumb" /> : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                      <div>
                        <strong>{m.matchedPerson.name}</strong><br/>
                        <small className="admin-text-secondary">{m.matchedPerson.lastSeen?.state}</small>
                      </div>
                    </div>
                  ) : (
                    <strong>Desconocido</strong>
                  )}
                </td>
                <td>
                  {m.person ? (
                    <div className="name-cell">
                      {m.person.photoUrl ? <img src={m.person.photoUrl} alt="Foto" className="person-thumb" /> : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                      <div>
                        <strong>{m.person.name}</strong><br/>
                        <small className="admin-text-secondary">{m.person.lastSeen?.state}</small>
                      </div>
                    </div>
                  ) : <span className="admin-text-danger">Reporte eliminado</span>}
                </td>
                <td>
                  <span className={m.score > 0.7 ? 'admin-score-high' : 'admin-score-medium'}>
                    {(m.score * 100).toFixed(1)}%
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${m.status === 'confirmado' ? 'found' : m.status === 'descartado' ? 'missing' : 'pending'}`}>
                    {m.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    {m.status !== 'confirmado' && (
                      <button className="btn-merge" onClick={() => setMergingMatch(m)} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        Revisar
                      </button>
                    )}
                    {m.status !== 'descartado' && <button className="btn-dismiss" onClick={() => changeStatus(m._id, 'descartado')}>Descartar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr><td colSpan={5} className="admin-table-empty-simple">No hay coincidencias generadas por la IA</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Side-by-Side Merge Modal (Moved outside .admin-section to escape containing block) */}
    {mergingMatch && (
      <div className="merge-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => !isMerging && setMergingMatch(null)}>
        <div className="merge-modal-content" style={{ backgroundColor: 'var(--clr-surface)', borderRadius: '16px', border: '1px solid var(--clr-border)', width: '100%', maxWidth: '1200px', maxHeight: '95vh', overflowY: 'auto', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--clr-border)', paddingBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GitMerge size={24} color="var(--clr-primary)" /> Fusión de Identidades (Merge)</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--clr-text-muted)', fontSize: '0.95rem' }}>Verifique cuidadosamente antes de ejecutar la fusión atómica de los perfiles.</p>
            </div>
            <button onClick={() => setMergingMatch(null)} disabled={isMerging} style={{ background: 'var(--clr-surface-alt)', border: '1px solid var(--clr-border)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', color: 'var(--clr-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><XCircle size={24} /></button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'stretch' }}>
            {/* Left Side: Original Report (id1) */}
            <div 
              style={{ backgroundColor: 'var(--clr-surface-alt)', padding: '2rem', borderRadius: '16px', border: '2px dashed var(--clr-border)', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => setExpandedPerson({ ...mergingMatch.matchedPerson, _isSearchReq: false, _title: 'Reporte Buscado (Familiar)' } || { ...mergingMatch.searchRequestId, _isSearchReq: true, _title: 'Reporte Buscado (Familiar)' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-text-muted)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}><User size={18} /> Reporte Buscado (Familiar)</div>
              
              {mergingMatch.searchRequestId ? (
                <>
                  <h3 style={{ margin: 0, color: 'var(--clr-text)', fontSize: '1.4rem' }}>{mergingMatch.searchRequestId.searchName}</h3>
                  <p style={{ fontSize: '1rem', color: 'var(--clr-text-muted)', margin: 0 }}>Reporte creado por: <strong>Familia/Conocidos</strong></p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', backgroundColor: 'var(--clr-background)', padding: '1rem', borderRadius: '8px', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)' }}>ID Solicitud:</span> <span style={{ fontFamily: 'monospace', color: 'var(--clr-text)' }}>{mergingMatch.searchRequestId._id}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--clr-text-muted)' }}>Categoría:</span> <span>{mergingMatch.searchRequestId.category || 'General'}</span></div>
                  </div>
                </>
              ) : mergingMatch.matchedPerson ? (
                <>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {mergingMatch.matchedPerson.photoUrl ? <img src={mergingMatch.matchedPerson.photoUrl} alt="Foto" style={{ width: 80, height: 80, borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} /> : <div style={{ width: 80, height: 80, borderRadius: '12px', backgroundColor: 'var(--clr-surface)', border: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={32} color="var(--clr-text-muted)" /></div>}
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--clr-text)', fontSize: '1.4rem' }}>{mergingMatch.matchedPerson.name}</h3>
                      <p style={{ fontSize: '1rem', color: 'var(--clr-text-muted)', margin: 0 }}>Visto en: <strong>{mergingMatch.matchedPerson.lastSeen?.state || 'Desconocido'}</strong></p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', backgroundColor: 'var(--clr-background)', padding: '1rem', borderRadius: '8px', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)' }}>ID Hash Original:</span> <span style={{ fontFamily: 'monospace', color: 'var(--clr-text)' }}>{mergingMatch.matchedPerson.idHash?.slice(0, 12)}...</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)', whiteSpace: 'nowrap', marginRight: '1rem' }}>Edad y Detalles:</span> <span style={{ textAlign: 'right', fontSize: '0.9rem', maxHeight: '80px', overflowY: 'auto' }}>{mergingMatch.matchedPerson.age || '?'} años • {mergingMatch.matchedPerson.description || mergingMatch.matchedPerson.lastSeen?.description || 'Sin desc.'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)' }}>Contacto Original:</span> <span>{mergingMatch.matchedPerson.contactPerson?.name || 'No registrado'} {mergingMatch.matchedPerson.contactPerson?.phone ? `(${mergingMatch.matchedPerson.contactPerson.phone})` : ''}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--clr-text-muted)' }}>Fuente de Datos:</span> <span>{mergingMatch.matchedPerson.metadata?.source || 'Familiar / Local'}</span></div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Center: Merge Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                <ArrowRight size={24} />
              </div>
              <div style={{ padding: '0.5rem 1rem', borderRadius: '20px', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                {(mergingMatch.score * 100).toFixed(1)}% Match
              </div>
            </div>

            {/* Right Side: Institution Report (id2) */}
            <div 
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '2rem', borderRadius: '16px', border: '2px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(16,185,129,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => setExpandedPerson({ ...mergingMatch.person, _isSearchReq: false, _title: 'Registro Institucional Físico' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}><ShieldCheck size={18} /> Registro Institucional Físico</div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {mergingMatch.person?.photoUrl ? <img src={mergingMatch.person.photoUrl} alt="Foto" style={{ width: 80, height: 80, borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} /> : <div style={{ width: 80, height: 80, borderRadius: '12px', backgroundColor: 'var(--clr-surface)', border: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={32} color="var(--clr-text-muted)" /></div>}
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--clr-text)', fontSize: '1.4rem' }}>{mergingMatch.person?.name || 'Desconocido'}</h3>
                  <p style={{ fontSize: '1rem', color: 'var(--clr-text-muted)', margin: 0 }}>Visto en: <strong>{mergingMatch.person?.lastSeen?.state || 'Desconocido'}</strong></p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', backgroundColor: 'var(--clr-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)' }}>ID Hash Físico:</span> <span style={{ fontFamily: 'monospace', color: 'var(--clr-text)' }}>{mergingMatch.person?.idHash?.slice(0, 12)}...</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)', whiteSpace: 'nowrap', marginRight: '1rem' }}>Edad y Detalles:</span> <span style={{ textAlign: 'right', fontSize: '0.9rem', maxHeight: '80px', overflowY: 'auto' }}>{mergingMatch.person?.age || '?'} años • {mergingMatch.person?.description || mergingMatch.person?.lastSeen?.description || 'Sin desc.'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '0.5rem' }}><span style={{ color: 'var(--clr-text-muted)' }}>Contacto Actual:</span> <span>{mergingMatch.person?.contactPerson?.name || 'No registrado'} {mergingMatch.person?.contactPerson?.phone ? `(${mergingMatch.person.contactPerson.phone})` : ''}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--clr-text-muted)' }}>Estado Base de Datos:</span> <span style={{ color: '#10b981', fontWeight: 500 }}>Activo ({mergingMatch.person?.status || 'encontrado'})</span></div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '1.5rem', borderRadius: '12px', fontSize: '1rem', color: '#ca8a04', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '1.1rem' }}>Auditoría Forense Requerida</strong>
              <span style={{ opacity: 0.9 }}>Al confirmar, la persona buscada absorberá los datos institucionales (ubicación, foto) y cambiará su estado a "Encontrado". Esta acción es permanente y quedará registrada en el Audit Log con su ID de operador.</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--clr-border)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={() => setMergingMatch(null)} disabled={isMerging} style={{ padding: '0.75rem 2rem' }}>Cancelar Operación</Button>
            <Button variant="outline" onClick={async () => {
              await changeStatus(mergingMatch._id, 'descartado');
              setMergingMatch(null);
            }} disabled={isMerging} style={{ padding: '0.75rem 2rem', color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' }}>
              Descartar Match (Falso Positivo)
            </Button>
            <Button onClick={() => handleMergeConfirm(mergingMatch.matchedPerson?.idHash || mergingMatch.searchRequestId?._id, mergingMatch.person?.idHash)} disabled={isMerging} style={{ minWidth: '220px', padding: '0.75rem 2rem', fontSize: '1rem' }}>
              {isMerging ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Loader2 className="spinner" size={20} /> Ejecutando Fusión...</div> : 'Confirmar Fusión Atómica'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Expanded Person Modal */}
    {expandedPerson && (
      <div className="expanded-person-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setExpandedPerson(null)}>
        <div className="expanded-person-content" style={{ backgroundColor: 'var(--clr-surface)', borderRadius: '16px', border: '1px solid var(--clr-border)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setExpandedPerson(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--clr-surface-alt)', border: '1px solid var(--clr-border)', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', color: 'var(--clr-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><XCircle size={24} /></button>
          
          <div>
            <div style={{ color: 'var(--clr-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{expandedPerson._title}</div>
            <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--clr-text)' }}>{expandedPerson.name || expandedPerson.searchName}</h2>
          </div>

          {!expandedPerson._isSearchReq && (
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {expandedPerson.photoUrl && (
                <img src={expandedPerson.photoUrl} alt="Foto extendida" style={{ width: '200px', height: '200px', objectFit: 'cover', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              )}
              <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--clr-background)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--clr-border)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--clr-text)', fontSize: '1.1rem', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}>Detalles Clínicos y Físicos</h4>
                  <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--clr-text)', whiteSpace: 'pre-wrap' }}>
                    {expandedPerson.description || expandedPerson.lastSeen?.description || 'No hay descripción disponible.'}
                  </p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'var(--clr-surface-alt)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', textTransform: 'uppercase' }}>Edad</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{expandedPerson.age || '?'} años</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--clr-surface-alt)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', textTransform: 'uppercase' }}>Género</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{expandedPerson.gender === 'F' ? 'Femenino' : expandedPerson.gender === 'M' ? 'Masculino' : 'Otro'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div style={{ backgroundColor: 'var(--clr-surface-alt)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--clr-border)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--clr-text)', fontSize: '1.1rem', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.5rem' }}>Metadatos del Sistema</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem', display: 'block' }}>ID Interno Hash:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1rem', wordBreak: 'break-all', display: 'block' }}>{expandedPerson.idHash || expandedPerson._id}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem', display: 'block' }}>Última vez visto en:</span>
                <span style={{ fontSize: '1rem', wordBreak: 'break-word', display: 'block' }}>{expandedPerson.lastSeen?.state || expandedPerson.lastSeen?.municipality || 'Desconocido'}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem', display: 'block' }}>Fuente:</span>
                <span style={{ fontSize: '1rem', wordBreak: 'break-word', display: 'block' }}>{expandedPerson.metadata?.source || expandedPerson.category || 'Local'}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.9rem', display: 'block' }}>Contacto Familiar:</span>
                <span style={{ fontSize: '1rem', wordBreak: 'break-word', display: 'block' }}>{expandedPerson.contactPerson?.name || 'No registrado'} {expandedPerson.contactPerson?.phone ? `(${expandedPerson.contactPerson.phone})` : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Sección: Usuarios ──────────────────────────────────────────
function SectionUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'users' | 'verifications'>('users');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, verifRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/verifications')
      ]);
      setUsers(usersRes.data);
      setVerifications(verifRes.data);
    } catch (e) {
      console.error(e);
      alert('Error cargando datos (¿Eres admin?)');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const changeRole = async (id: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u._id === id ? { ...u, role: newRole } : u));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error cambiando rol');
    }
  };

  const changeUserStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: newStatus } : u));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error cambiando estado');
    }
  };

  const changeVerificationStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/verifications/${id}/status`, { status: newStatus });
      setVerifications(prev => prev.map(v => v._id === id ? { ...v, status: newStatus } : v));
      if (newStatus === 'approved') {
        loadData(); // recargar para ver el nuevo rol
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error actualizando solicitud');
    }
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando datos...</span></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header admin-header-actions">
        <h3><Users size={18} /> Control de Usuarios</h3>
        <div className="admin-header-button-group">
          <Button onClick={() => setViewMode('users')} variant={viewMode === 'users' ? 'primary' : 'outline'} size="sm">Usuarios Registrados</Button>
          <Button onClick={() => setViewMode('verifications')} variant={viewMode === 'verifications' ? 'primary' : 'outline'} size="sm">Solicitudes ({verifications.filter(v => v.status === 'pending').length})</Button>
        </div>
      </div>
      
      {viewMode === 'users' ? (
      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol Actual</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td>
                  <div className="name-cell">
                    {u.picture ? <img src={u.picture} alt={u.name} className="person-thumb" /> : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                    <div><strong>{u.name}</strong></div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin-badge ${u.role === 'admin' ? 'missing' : u.role === 'verifier' ? 'api' : 'found'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${u.status === 'approved' ? 'found' : u.status === 'rejected' ? 'missing' : 'pending'}`}>
                    {(u.status || 'pending').toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    {(u.status === 'pending' || !u.status) && (
                      <button className="btn-found" onClick={() => changeUserStatus(u._id, 'approved')}>Aprobar</button>
                    )}
                    {u.role !== 'admin' && <button className="btn-merge" onClick={() => changeRole(u._id, 'admin')}>Admin</button>}
                    {u.role !== 'verifier' && <button className="btn-found" onClick={() => changeRole(u._id, 'verifier')}>Verificador</button>}
                    {u.role !== 'user' && <button className="btn-dismiss" onClick={() => changeRole(u._id, 'user')}>Quitar Rol</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
      <div className="table-responsive-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Notas</th>
              <th>Evidencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {verifications.map(v => (
              <tr key={v._id}>
                <td>
                  <div className="name-cell">
                    {v.user?.picture ? <img src={v.user.picture} alt={v.user.name} className="person-thumb" /> : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                    <div>
                      <strong>{v.user?.name}</strong>
                      <div className="admin-user-email">{v.user?.email}</div>
                    </div>
                  </div>
                </td>
                <td>{v.notes || '-'}</td>
                <td>{v.evidenceUrl ? <a href={v.evidenceUrl} target="_blank" rel="noreferrer">Ver Archivo</a> : '-'}</td>
                <td>
                  <span className={`admin-badge ${v.status === 'approved' ? 'found' : v.status === 'rejected' ? 'missing' : 'pending'}`}>
                    {v.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {v.status === 'pending' && (
                    <div className="action-buttons">
                      <button className="btn-found" onClick={() => changeVerificationStatus(v._id, 'approved')}>Aprobar</button>
                      <button className="btn-dismiss" onClick={() => changeVerificationStatus(v._id, 'rejected')}>Rechazar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {verifications.length === 0 && (
              <tr><td colSpan={5} className="admin-table-empty-simple">No hay solicitudes de verificación</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────────
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<'resumen' | 'matches' | 'registros' | 'busquedas' | 'moderacion' | 'usuarios'>('resumen');
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [counts, setCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/persons?limit=200'),
      api.get('/persons/counts')
    ]).then(([personsRes, countsRes]) => {
      setPersons(personsRes.data || []);
      setCounts(countsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (idHash: string, newStatus: string) => {
    setPersons(prev => prev.map(p => p.idHash === idHash ? { ...p, status: newStatus } : p));
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div>
            <h2>Reencuentro<span>VE</span></h2>
            <small>Panel de Administración</small>
          </div>
        </div>

        {([
          ['resumen',    'Resumen General',    <LayoutDashboard size={18} />],
          ['moderacion', 'Moderación (Nuevos)', <ShieldAlert size={18} />],
          ['matches',    'Auditoría de Matches', <Search size={18} />],
          ['registros',  'Control Registros',  <ShieldCheck size={18} />],
          ['busquedas',  'Solicitudes (Familias)', <Search size={18} />],
          ['usuarios',   'Usuarios (Roles)',   <Users size={18} />],
        ] as const).map(([key, label, icon]) => (
          <div
            key={key}
            className={`admin-nav-item ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            {icon}
            {label}
          </div>
        ))}

        <div className="admin-sidebar-footer">
          <button className="admin-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Volver al Mapa
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="admin-topbar">
        <div className="admin-topbar-header-row">
          <h1>
            {activeSection === 'resumen'    && 'Resumen General'}
            {activeSection === 'moderacion' && 'Moderación de Reportes'}
            {activeSection === 'matches'    && 'Revisión y Fusión de Perfiles'}
            {activeSection === 'registros'  && 'Control de Registros'}
            {activeSection === 'busquedas'  && 'Búsquedas Activas de Familiares'}
            {activeSection === 'usuarios'   && 'Gestión de Usuarios y Roles'}
          </h1>
          <button className="admin-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
          <div className="admin-topbar-meta">
            <span>{counts ? (counts.total || 0).toLocaleString() : persons.length} registros totales</span>
          </div>
        </header>

        <div className="admin-content">
          {activeSection === 'resumen' && (
            <>
              <SectionResumen counts={counts} />
            </>
          )}
          {activeSection === 'moderacion' && <SectionModeracion />}
          {activeSection === 'matches' && <SectionMatches />}
          {activeSection === 'busquedas' && <SectionBusquedas />}
          {activeSection === 'registros' && (
            <SectionRegistros
              persons={persons}
              loading={loading}
              onStatusChange={handleStatusChange}
            />
          )}
          {activeSection === 'usuarios' && <SectionUsuarios />}
        </div>
      </main>
    </div>
  );
};
