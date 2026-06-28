import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, GitMerge, ShieldCheck,
  ArrowLeft, Search, Loader2, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import './AdminDashboard.css';

const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

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

// ── Sección: Duplicados ──────────────────────────────────────
function SectionDuplicados() {
  const [jobs, setJobs] = useState<AuditJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/audit', { headers: { 'x-api-key': ADMIN_KEY } });
      setJobs(res.data);
    } catch { /* silenciar errores 401 si la key no está configurada */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const merge = async (jobId: string, targetIdHash: string) => {
    await api.post(`/admin/audit/${jobId}/merge`, { targetIdHash }, { headers: { 'x-api-key': ADMIN_KEY } });
    setJobs(prev => prev.filter(j => j.jobId !== jobId));
  };

  const dismiss = async (jobId: string) => {
    await api.post(`/admin/audit/${jobId}/dismiss`, {}, { headers: { 'x-api-key': ADMIN_KEY } });
    setJobs(prev => prev.filter(j => j.jobId !== jobId));
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando cola de auditoría...</span></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><GitMerge size={18} /> Duplicados Detectados por IA</h3>
        <span className="admin-badge pending">{jobs.length} pendientes</span>
      </div>
      {jobs.length === 0 ? (
        <div className="admin-empty-state">
          <CheckCircle size={40} color="#34d399" />
          <p>¡Sin duplicados pendientes! El sistema está limpio.</p>
        </div>
      ) : (
        <div className="table-responsive-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reporte Entrante</th>
                <th>Candidato Existente</th>
                <th>Similitud</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.jobId}>
                  <td>
                    <div className="name-cell">
                      <div className="person-thumb-placeholder"><Users size={16} /></div>
                      <div>
                        <strong>{job.incoming?.personData?.name || '—'}</strong><br />
                        <small style={{ color: '#64748b' }}>{job.incoming?.personData?.lastSeen?.state || ''}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {job.candidates?.slice(0, 1).map((c: any) => (
                      <div key={c.idHash} className="name-cell">
                        <div className="person-thumb-placeholder"><Users size={16} /></div>
                        <div>
                          <strong>{c.name}</strong><br />
                          <small style={{ color: '#64748b' }}>{c.lastSeen?.state || ''}</small>
                        </div>
                      </div>
                    ))}
                  </td>
                  <td><span className="admin-badge pending">Alta</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-merge" onClick={() => merge(job.jobId, job.candidates?.[0]?.idHash)}>
                        Fusionar
                      </button>
                      <button className="btn-dismiss" onClick={() => dismiss(job.jobId)}>
                        Son diferentes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const changeStatus = async (idHash: string, newStatus: string) => {
    try {
      await api.patch(`/admin/persons/${idHash}/status`, { status: newStatus }, {
        headers: { 'x-api-key': ADMIN_KEY }
      });
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
                          <strong style={{ color: '#f1f5f9' }}>{p.name}</strong><br />
                          <small style={{ color: '#64748b' }}>{state}{p.age ? ` · ${p.age} años` : ''}</small>
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
                      <span style={{ color: urgency > 70 ? '#fb7185' : urgency > 40 ? 'var(--clr-amber)' : '#34d399', fontWeight: 600 }}>
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
                <tr key="empty-state"><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sección: Matches de IA ────────────────────────────────────
function SectionMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/matches');
      setMatches(res.data);
    } catch (e) {
      console.error(e);
      alert('Error cargando coincidencias (¿Tienes permisos?)');
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
      alert(e.response?.data?.error || 'Error actualizando match');
    }
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spinner" size={24} /><span>Cargando coincidencias...</span></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h3><GitMerge size={18} /> Coincidencias de Búsqueda (Matches IA)</h3>
        <span className="admin-badge pending">{matches.length} Matches</span>
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
                  <strong>Buscado:</strong> {m.searchRequestId?.searchName || 'Desconocido'}<br/>
                  <small style={{ color: 'var(--text-secondary)' }}>{m.searchRequestId?.category || 'Sin categoría'}</small>
                </td>
                <td>
                  {m.person ? (
                    <div className="name-cell">
                      {m.person.photoUrl ? <img src={m.person.photoUrl} alt="Foto" className="person-thumb" /> : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                      <div>
                        <strong>{m.person.name}</strong><br/>
                        <small style={{ color: 'var(--text-secondary)' }}>{m.person.lastSeen?.state}</small>
                      </div>
                    </div>
                  ) : <span style={{ color: 'var(--clr-danger)' }}>Reporte eliminado</span>}
                </td>
                <td>
                  <span style={{ fontWeight: 'bold', color: m.score > 0.7 ? 'var(--clr-success)' : 'var(--clr-amber)' }}>
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
                    {m.status !== 'confirmado' && <button className="btn-found" onClick={() => changeStatus(m._id, 'confirmado')}>Confirmar</button>}
                    {m.status !== 'descartado' && <button className="btn-dismiss" onClick={() => changeStatus(m._id, 'descartado')}>Descartar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No hay coincidencias generadas por la IA</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
      <div className="admin-section-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h3><Users size={18} /> Control de Usuarios</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setViewMode('users')} className={`admin-back-btn ${viewMode === 'users' ? 'active' : ''}`} style={{ background: viewMode === 'users' ? 'var(--blue)' : 'transparent', color: '#fff', border: '1px solid var(--line)' }}>Usuarios Registrados</button>
          <button onClick={() => setViewMode('verifications')} className={`admin-back-btn ${viewMode === 'verifications' ? 'active' : ''}`} style={{ background: viewMode === 'verifications' ? 'var(--blue)' : 'transparent', color: '#fff', border: '1px solid var(--line)' }}>Solicitudes ({verifications.filter(v => v.status === 'pending').length})</button>
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
              <th>Acciones de Rol</th>
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
                  <div className="action-buttons">
                    {u.role !== 'admin' && <button className="btn-merge" onClick={() => changeRole(u._id, 'admin')}>Hacer Admin</button>}
                    {u.role !== 'verifier' && <button className="btn-found" onClick={() => changeRole(u._id, 'verifier')}>Hacer Verificador</button>}
                    {u.role !== 'user' && <button className="btn-dismiss" onClick={() => changeRole(u._id, 'user')}>Quitar Permisos</button>}
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
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{v.user?.email}</div>
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
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No hay solicitudes de verificación</td></tr>
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
  const [activeSection, setActiveSection] = useState<'resumen' | 'matches' | 'duplicados' | 'registros' | 'usuarios'>('resumen');
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [counts, setCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/persons?limit=200'),
      api.get('/persons/counts')
    ]).then(([personsRes, countsRes]) => {
      setPersons(personsRes.data.persons || []);
      setCounts(countsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (idHash: string, newStatus: string) => {
    setPersons(prev => prev.map(p => p.idHash === idHash ? { ...p, status: newStatus } : p));
  };

  const pendingCount = counts ? (counts.pending || 0) : 0;

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
          ['matches',    'Matches de Búsqueda', <GitMerge size={18} />],
          ['duplicados', 'Duplicados (Data)',  <GitMerge size={18} />],
          ['registros',  'Control Registros',  <ShieldCheck size={18} />],
          ['usuarios',   'Usuarios (Roles)',   <Users size={18} />],
        ] as const).map(([key, label, icon]) => (
          <div
            key={key}
            className={`admin-nav-item ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            {icon}
            {label}
            {key === 'duplicados' && pendingCount > 0 && (
              <span className="admin-nav-badge">{pendingCount}</span>
            )}
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
            {activeSection === 'matches'    && 'Coincidencias de Búsqueda (IA)'}
            {activeSection === 'duplicados' && 'Gestión de Datos Duplicados'}
            {activeSection === 'registros'  && 'Control de Registros'}
            {activeSection === 'usuarios'   && 'Gestión de Usuarios y Roles'}
          </h1>
          <button className="admin-back-btn" onClick={onBack} style={{ display: 'none' /* Will show on mobile by default later if needed, actually we hide it in bottom nav so let's put it here */ }}>
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
              <SectionDuplicados />
            </>
          )}
          {activeSection === 'duplicados' && <SectionDuplicados />}
          {activeSection === 'matches' && <SectionMatches />}
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
