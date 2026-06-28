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
function SectionResumen({ persons }: { persons: PersonRow[] }) {
  const missing = persons.filter(p => p.status === 'missing').length;
  const found   = persons.filter(p => p.status === 'found').length;
  const pending = persons.filter(p => (p['metadata.auditStatus'] || p.metadata?.auditStatus) === 'pending_review').length;
  const manual  = persons.filter(p => (p['metadata.source'] || p.metadata?.source) === 'manual').length;

  return (
    <div className="admin-stats-row">
      <div className="admin-stat-card">
        <div className="admin-stat-icon red"><Users size={22} /></div>
        <div><h4>{missing}</h4><p>Personas Desaparecidas</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon green"><CheckCircle size={22} /></div>
        <div><h4>{found}</h4><p>Personas Encontradas</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon amber"><AlertTriangle size={22} /></div>
        <div><h4>{pending}</h4><p>Pendientes de Revisión</p></div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-icon blue"><GitMerge size={22} /></div>
        <div><h4>{manual}</h4><p>Reportes Manuales (IA)</p></div>
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
                      <span style={{ color: urgency > 70 ? '#fb7185' : urgency > 40 ? '#fbbf24' : '#34d399', fontWeight: 600 }}>
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

// ── Componente Principal ─────────────────────────────────────
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<'resumen' | 'duplicados' | 'registros'>('resumen');
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/persons?limit=5000').then(res => {
      setPersons(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (idHash: string, newStatus: string) => {
    setPersons(prev => prev.map(p => p.idHash === idHash ? { ...p, status: newStatus } : p));
  };

  const pendingCount = persons.filter(p => (p['metadata.auditStatus'] || p.metadata?.auditStatus) === 'pending_review').length;

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
          ['duplicados', 'Duplicados (IA)',     <GitMerge size={18} />],
          ['registros',  'Control Registros',  <ShieldCheck size={18} />],
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
            {activeSection === 'duplicados' && 'Gestión de Duplicados'}
            {activeSection === 'registros'  && 'Control de Registros'}
          </h1>
          <button className="admin-back-btn" onClick={onBack} style={{ display: 'none' /* Will show on mobile by default later if needed, actually we hide it in bottom nav so let's put it here */ }}>
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
          <div className="admin-topbar-meta">
            <span>{persons.length.toLocaleString()} registros totales</span>
          </div>
        </header>

        <div className="admin-content">
          {activeSection === 'resumen' && (
            <>
              <SectionResumen persons={persons} />
              <SectionDuplicados />
            </>
          )}
          {activeSection === 'duplicados' && <SectionDuplicados />}
          {activeSection === 'registros' && (
            <SectionRegistros
              persons={persons}
              loading={loading}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </main>
    </div>
  );
};
