/**
 * SectionMatches.tsx — Auditoría de matches generados por IA
 *
 * PROPÓSITO:
 *   Muestra las coincidencias que la IA ha detectado entre
 *   solicitudes de búsqueda y registros de la base de datos.
 *   Permite al administrador:
 *   1. Revisar cada match en detalle (side-by-side).
 *   2. Fusionar (merge) dos perfiles en uno.
 *   3. Descartar falsos positivos.
 *   4. Ver metadatos expandidos de cualquier persona.
 *
 * FLUJO DE FUSIÓN:
 *   1. La IA detecta una posible coincidencia y la guarda en
 *      /admin/matches con un score de similitud (0.0 - 1.0).
 *   2. El admin abre el modal de merge (side-by-side).
 *   3. Revisa ambos perfiles y decide:
 *      - Fusionar: POST /admin/merge/:id1/:id2 → combina datos.
 *      - Descartar: marca el match como falso positivo.
 *
 * SEGURIDAD:
 *   - La fusión es atómica y permanente (queda en Audit Log).
 *   - El modal de merge muestra una advertencia antes de confirmar.
 *   - El botón de fusión se deshabilita mientras se procesa.
 *
 * ERRORES:
 *   Si el usuario no es admin, el backend responde 403 y se
 *   muestra un mensaje claro de que debe cerrar sesión y
 *   volver a entrar.
 */
import { useState, useEffect, useCallback } from 'react';
import { GitMerge, Users, ShieldCheck, AlertTriangle, ArrowRight, XCircle, Loader2, User } from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';

export function SectionMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [mergingMatch, setMergingMatch] = useState<any>(null);  // Modal de merge
  const [isMerging, setIsMerging] = useState(false);             // Estado de carga del merge
  const [expandedPerson, setExpandedPerson] = useState<any>(null); // Modal expandido

  // loadMatches: obtiene los matches de la IA.
  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/matches');
      setMatches(res.data);
      setErrorMsg('');
    } catch (e: any) {
      console.error(e);
      // Mensaje amigable si el token expiró o no es admin.
      setErrorMsg(e.response?.data?.error ||
        'Acceso Denegado. Tu sesión actual no tiene los permisos de administrador actualizados en el servidor (el Token expiró o es antiguo). Por favor, Cierra Sesión y vuelve a entrar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  // changeStatus: cambia el estado de un match (confirmar/descartar).
  const changeStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/matches/${id}/status`, { status: newStatus });
      setMatches(prev => prev.map(m =>
        m._id === id ? { ...m, status: newStatus } : m
      ));
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error actualizando match');
    }
  };

  // handleMergeConfirm: ejecuta la fusión atómica.
  const handleMergeConfirm = async (id1: string, id2: string) => {
    setIsMerging(true);
    setErrorMsg('');
    try {
      await api.post(`/admin/merge/${id1}/${id2}`);
      // Elimina el match de la tabla (ya está fusionado).
      setMatches(prev => prev.filter(m =>
        m.person?.idHash !== id2 && m.searchRequestId?._id !== id1
      ));
      setMergingMatch(null);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Error al fusionar perfiles');
    } finally {
      setIsMerging(false);
    }
  };

  if (loading) return <LoadingScreen text="Cargando coincidencias..." />;

  return (
    <>
      <div className="admin-section">
        {errorMsg && (
          <div className="admin-error-banner">
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
                  {/* Columna izquierda: la alerta que disparó el match */}
                  <td>
                    {m.searchRequestId ? (
                      <>
                        <strong>Buscado:</strong> {m.searchRequestId.searchName}<br />
                        <small className="admin-text-secondary">{m.searchRequestId.category}</small>
                      </>
                    ) : m.matchedPerson ? (
                      <div className="name-cell">
                        {m.matchedPerson.photoUrl
                          ? <img src={m.matchedPerson.photoUrl} alt="Foto" className="person-thumb" />
                          : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                        <div>
                          <strong>{m.matchedPerson.name}</strong><br />
                          <small className="admin-text-secondary">{m.matchedPerson.lastSeen?.state}</small>
                        </div>
                      </div>
                    ) : (
                      <strong>Desconocido</strong>
                    )}
                  </td>

                  {/* Columna derecha: el registro encontrado */}
                  <td>
                    {m.person ? (
                      <div className="name-cell">
                        {m.person.photoUrl
                          ? <img src={m.person.photoUrl} alt="Foto" className="person-thumb" />
                          : <div className="person-thumb-placeholder"><Users size={16} /></div>}
                        <div>
                          <strong>{m.person.name}</strong><br />
                          <small className="admin-text-secondary">{m.person.lastSeen?.state}</small>
                        </div>
                      </div>
                    ) : <span className="admin-text-danger">Reporte eliminado</span>}
                  </td>

                  {/* Score de similitud */}
                  <td>
                    <span className={m.score > 0.7 ? 'admin-score-high' : 'admin-score-medium'}>
                      {(m.score * 100).toFixed(1)}%
                    </span>
                  </td>

                  {/* Estado del match */}
                  <td>
                    <span className={`admin-badge ${m.status === 'confirmado' ? 'found' : m.status === 'descartado' ? 'missing' : 'pending'}`}>
                      {m.status.toUpperCase()}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td>
                    <div className="action-buttons">
                      {m.status !== 'confirmado' && (
                        <button className="btn-merge" onClick={() => setMergingMatch(m)}>
                          Revisar
                        </button>
                      )}
                      {m.status !== 'descartado' && (
                        <button className="btn-dismiss"
                          onClick={() => changeStatus(m._id, 'descartado')}>
                          Descartar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && (
                <tr><td colSpan={5}><EmptyState message="No hay coincidencias generadas por la IA" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Modal de fusión (side-by-side) ═══ */}
      {mergingMatch && (
        <div className="admin-merge-overlay" onClick={() => !isMerging && setMergingMatch(null)}>
          <div className="admin-merge-content" onClick={e => e.stopPropagation()}>

            {/* Header del modal */}
            <div className="admin-merge-header">
              <div>
                <h2 className="admin-merge-title"><GitMerge size={24} /> Fusión de Identidades (Merge)</h2>
                <p className="admin-merge-subtitle">Verifique cuidadosamente antes de ejecutar la fusión atómica de los perfiles.</p>
              </div>
              <button className="admin-merge-close" onClick={() => setMergingMatch(null)} disabled={isMerging}>
                <XCircle size={24} />
              </button>
            </div>

            {/* Grid de 3 columnas: izquierda → flecha → derecha */}
            <div className="admin-merge-grid">

              {/* ─── Columna izquierda: Reporte original ─── */}
              <div className="admin-merge-card admin-merge-card-report"
                onClick={() => setExpandedPerson(
                  mergingMatch.matchedPerson
                    ? { ...mergingMatch.matchedPerson, _isSearchReq: false, _title: 'Reporte Buscado (Familiar)' }
                    : { ...mergingMatch.searchRequestId, _isSearchReq: true, _title: 'Reporte Buscado (Familiar)' }
                )}>
                <div className="admin-merge-card-badge"><User size={18} /> Reporte Buscado (Familiar)</div>

                {mergingMatch.searchRequestId ? (
                  <>
                    <h3 className="admin-merge-name">{mergingMatch.searchRequestId.searchName}</h3>
                    <p className="admin-merge-detail">Reporte creado por: <strong>Familia/Conocidos</strong></p>
                    <div className="admin-merge-info-box">
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">ID Solicitud:</span>
                        <span className="admin-merge-info-value-mono">{mergingMatch.searchRequestId._id}</span>
                      </div>
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">Categoría:</span>
                        <span>{mergingMatch.searchRequestId.category || 'General'}</span>
                      </div>
                    </div>
                  </>
                ) : mergingMatch.matchedPerson ? (
                  <>
                    <div className="admin-merge-card-header">
                      {mergingMatch.matchedPerson.photoUrl ? (
                        <img src={mergingMatch.matchedPerson.photoUrl} alt="Foto" className="admin-merge-photo" />
                      ) : (
                        <div className="admin-merge-photo-placeholder"><Users size={32} /></div>
                      )}
                      <div>
                        <h3 className="admin-merge-name">{mergingMatch.matchedPerson.name}</h3>
                        <p className="admin-merge-detail">Visto en: <strong>{mergingMatch.matchedPerson.lastSeen?.state || 'Desconocido'}</strong></p>
                      </div>
                    </div>
                    <div className="admin-merge-info-box">
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">ID Hash Original:</span>
                        <span className="admin-merge-info-value-mono">{mergingMatch.matchedPerson.idHash?.slice(0, 12)}...</span>
                      </div>
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">Edad y Detalles:</span>
                        <span className="admin-merge-info-value-scroll">{mergingMatch.matchedPerson.age || '?'} años • {mergingMatch.matchedPerson.description || mergingMatch.matchedPerson.lastSeen?.description || 'Sin desc.'}</span>
                      </div>
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">Contacto Original:</span>
                        <span>{mergingMatch.matchedPerson.contactPerson?.name || 'No registrado'} {mergingMatch.matchedPerson.contactPerson?.phone ? `(${mergingMatch.matchedPerson.contactPerson.phone})` : ''}</span>
                      </div>
                      <div className="admin-merge-info-row">
                        <span className="admin-merge-info-label">Fuente de Datos:</span>
                        <span>{mergingMatch.matchedPerson.metadata?.source || 'Familiar / Local'}</span>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* ─── Columna central: flecha y score ─── */}
              <div className="admin-merge-center">
                <div className="admin-merge-arrow"><ArrowRight size={24} /></div>
                <div className="admin-merge-score">{(mergingMatch.score * 100).toFixed(1)}% Match</div>
              </div>

              {/* ─── Columna derecha: Registro institucional ─── */}
              <div className="admin-merge-card admin-merge-card-institution"
                onClick={() => setExpandedPerson({
                  ...mergingMatch.person,
                  _isSearchReq: false,
                  _title: 'Registro Institucional Físico'
                })}>
                <div className="admin-merge-card-badge admin-merge-card-badge-green"><ShieldCheck size={18} /> Registro Institucional Físico</div>

                <div className="admin-merge-card-header">
                  {mergingMatch.person?.photoUrl ? (
                    <img src={mergingMatch.person.photoUrl} alt="Foto" className="admin-merge-photo" />
                  ) : (
                    <div className="admin-merge-photo-placeholder"><Users size={32} /></div>
                  )}
                  <div>
                    <h3 className="admin-merge-name">{mergingMatch.person?.name || 'Desconocido'}</h3>
                    <p className="admin-merge-detail">Visto en: <strong>{mergingMatch.person?.lastSeen?.state || 'Desconocido'}</strong></p>
                  </div>
                </div>

                <div className="admin-merge-info-box admin-merge-info-box-green">
                  <div className="admin-merge-info-row">
                    <span className="admin-merge-info-label">ID Hash Físico:</span>
                    <span className="admin-merge-info-value-mono">{mergingMatch.person?.idHash?.slice(0, 12)}...</span>
                  </div>
                  <div className="admin-merge-info-row">
                    <span className="admin-merge-info-label">Edad y Detalles:</span>
                    <span className="admin-merge-info-value-scroll">{mergingMatch.person?.age || '?'} años • {mergingMatch.person?.description || mergingMatch.person?.lastSeen?.description || 'Sin desc.'}</span>
                  </div>
                  <div className="admin-merge-info-row">
                    <span className="admin-merge-info-label">Contacto Actual:</span>
                    <span>{mergingMatch.person?.contactPerson?.name || 'No registrado'} {mergingMatch.person?.contactPerson?.phone ? `(${mergingMatch.person.contactPerson.phone})` : ''}</span>
                  </div>
                  <div className="admin-merge-info-row">
                    <span className="admin-merge-info-label">Estado Base de Datos:</span>
                    <span className="admin-merge-status-active">Activo ({mergingMatch.person?.status || 'encontrado'})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advertencia de auditoría */}
            <div className="admin-merge-warning">
              <AlertTriangle size={24} />
              <div>
                <strong className="admin-merge-warning-strong">Auditoría Forense Requerida</strong>
                <span>Al confirmar, la persona buscada absorberá los datos institucionales (ubicación, foto) y cambiará su estado a "Encontrado". Esta acción es permanente y quedará registrada en el Audit Log con su ID de operador.</span>
              </div>
            </div>

            {/* Footer: 3 botones */}
            <div className="admin-merge-footer">
              <Button variant="outline" onClick={() => setMergingMatch(null)} disabled={isMerging}>
                Cancelar Operación
              </Button>
              <Button variant="outline" className="admin-merge-footer-danger"
                onClick={async () => {
                  await changeStatus(mergingMatch._id, 'descartado');
                  setMergingMatch(null);
                }} disabled={isMerging}>
                Descartar Match (Falso Positivo)
              </Button>
              <Button className="admin-merge-footer-confirm"
                onClick={() => handleMergeConfirm(
                  mergingMatch.matchedPerson?.idHash || mergingMatch.searchRequestId?._id,
                  mergingMatch.person?.idHash
                )} disabled={isMerging}>
                {isMerging ? (
                  <span className="admin-merge-spinner"><Loader2 className="spinner" size={20} /> Ejecutando Fusión...</span>
                ) : 'Confirmar Fusión Atómica'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal de persona expandida ═══ */}
      {expandedPerson && (
        <div className="admin-expanded-overlay" onClick={() => setExpandedPerson(null)}>
          <div className="admin-expanded-content" onClick={e => e.stopPropagation()}>
            <button className="admin-expanded-close" onClick={() => setExpandedPerson(null)}>
              <XCircle size={24} />
            </button>

            <div>
              <div className="admin-expanded-badge">{expandedPerson._title}</div>
              <h2 className="admin-expanded-name">{expandedPerson.name || expandedPerson.searchName}</h2>
            </div>

            {!expandedPerson._isSearchReq && (
              <div className="admin-expanded-photo-section">
                {expandedPerson.photoUrl && (
                  <img src={expandedPerson.photoUrl} alt="Foto extendida" className="admin-expanded-photo" />
                )}
                <div className="admin-expanded-details">
                  <div className="admin-expanded-detail-box">
                    <h4 className="admin-expanded-detail-title">Detalles Clínicos y Físicos</h4>
                    <p className="admin-expanded-detail-text">
                      {expandedPerson.description || expandedPerson.lastSeen?.description || 'No hay descripción disponible.'}
                    </p>
                  </div>

                  <div className="admin-expanded-stat-grid">
                    <div className="admin-expanded-stat">
                      <div className="admin-expanded-stat-label">Edad</div>
                      <div className="admin-expanded-stat-value">{expandedPerson.age || '?'} años</div>
                    </div>
                    <div className="admin-expanded-stat">
                      <div className="admin-expanded-stat-label">Género</div>
                      <div className="admin-expanded-stat-value">
                        {expandedPerson.gender === 'F' ? 'Femenino'
                          : expandedPerson.gender === 'M' ? 'Masculino' : 'Otro'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="admin-expanded-meta">
              <h4 className="admin-expanded-detail-title">Metadatos del Sistema</h4>
              <div className="admin-expanded-meta-grid">
                <div className="admin-expanded-meta-item">
                  <span className="admin-expanded-meta-label">ID Interno Hash:</span>
                  <span className="admin-expanded-meta-value admin-expanded-meta-value-mono">
                    {expandedPerson.idHash || expandedPerson._id}
                  </span>
                </div>
                <div className="admin-expanded-meta-item">
                  <span className="admin-expanded-meta-label">Última vez visto en:</span>
                  <span className="admin-expanded-meta-value">
                    {expandedPerson.lastSeen?.state || expandedPerson.lastSeen?.municipality || 'Desconocido'}
                  </span>
                </div>
                <div className="admin-expanded-meta-item">
                  <span className="admin-expanded-meta-label">Fuente:</span>
                  <span className="admin-expanded-meta-value">
                    {expandedPerson.metadata?.source || expandedPerson.category || 'Local'}
                  </span>
                </div>
                <div className="admin-expanded-meta-item">
                  <span className="admin-expanded-meta-label">Contacto Familiar:</span>
                  <span className="admin-expanded-meta-value">
                    {expandedPerson.contactPerson?.name || 'No registrado'}
                    {expandedPerson.contactPerson?.phone ? `(${expandedPerson.contactPerson.phone})` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
