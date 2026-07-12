/**
 * SectionUsuarios.tsx — Gestión de usuarios y verificaciones
 *
 * PROPÓSITO:
 *   Panel de administración de usuarios con dos sub-vistas:
 *   1. "Usuarios Registrados": tabla con todos los usuarios,
 *      permite cambiar rol (user/verifier/admin) y estado
 *      (pending/approved/rejected).
 *   2. "Solicitudes": tabla de solicitudes de verificación
 *      (cuando un usuario pide ser "verificador"), permite
 *      aprobar o rechazar con un click.
 *
 * CAMBIO DE ROL:
 *   - changeRole(): PATCH /admin/users/:id/role.
 *   - Si el usuario ya tiene el rol, no se muestra el botón.
 *   - Un admin no puede quitarse el rol a sí mismo (no hay
 *     validación local, pero el backend lo rechazaría).
 *
 * SOLICITUDES DE VERIFICACIÓN:
 *   - changeVerificationStatus(): PATCH /admin/verifications/:id/status.
 *   - Si se aprueba, se recargan los datos (loadData) para que
 *     el usuario aparezca con el nuevo rol en la tabla de usuarios.
 */
import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { api } from '../../../services/api';
import { useToast } from '../../../store/ToastContext';
import { Button } from '../../../components/ui/Button';
import { NameCell } from '../../../components/common/NameCell';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  picture?: string;
}

interface AdminVerification {
  _id: string;
  user?: { name?: string; picture?: string; email?: string };
  notes?: string;
  evidenceUrl?: string;
  status: string;
}

export function SectionUsuarios() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'users' | 'verifications'>('users');

  // loadData: obtiene usuarios y solicitudes en paralelo.
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
      addToast('Error cargando datos (¿Eres admin?)', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // changeRole: cambia el rol de un usuario.
  const changeRole = async (id: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u._id === id ? { ...u, role: newRole } : u));
    } catch (e: any) {
      addToast(e.response?.data?.error || 'Error cambiando rol', 'error');
    }
  };

  // changeUserStatus: cambia el estado de un usuario (aprobar/rechazar).
  const changeUserStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: newStatus } : u));
    } catch (e: any) {
      addToast(e.response?.data?.error || 'Error cambiando estado', 'error');
    }
  };

  // changeVerificationStatus: aprueba o rechaza una solicitud.
  // Si se aprueba, recarga los datos para reflejar el nuevo rol.
  const changeVerificationStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/admin/verifications/${id}/status`, { status: newStatus });
      setVerifications(prev => prev.map(v => v._id === id ? { ...v, status: newStatus } : v));
      if (newStatus === 'approved') {
        loadData(); // Recarga para que el usuario aparezca con el nuevo rol.
      }
    } catch (e: any) {
      addToast(e.response?.data?.error || 'Error actualizando solicitud', 'error');
    }
  };

  if (loading) return <LoadingScreen text="Cargando datos..." />;

  return (
    <div className="admin-section">
      {/* Header con tabs de cambio de vista */}
      <div className="admin-section-header admin-header-actions">
        <h3><Users size={18} /> Control de Usuarios</h3>
        <div className="admin-header-button-group">
          <Button onClick={() => setViewMode('users')}
            variant={viewMode === 'users' ? 'primary' : 'outline'} size="sm">
            Usuarios Registrados
          </Button>
          <Button onClick={() => setViewMode('verifications')}
            variant={viewMode === 'verifications' ? 'primary' : 'outline'} size="sm">
            Solicitudes ({verifications.filter(v => v.status === 'pending').length})
          </Button>
        </div>
      </div>

      {/* ═══ Vista: Usuarios ═══ */}
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
                    <NameCell name={u.name} photoUrl={u.picture} size={36} />
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
                      {/* Aprobar usuario pendiente */}
                      {(u.status === 'pending' || !u.status) && (
                        <button className="btn-found"
                          onClick={() => changeUserStatus(u._id, 'approved')}>Aprobar</button>
                      )}
                      {/* Botones de cambio de rol.
                          Cada botón se muestra solo si el usuario NO tiene ya ese rol. */}
                      {u.role !== 'admin' && (
                        <button className="btn-merge"
                          onClick={() => changeRole(u._id, 'admin')}>Admin</button>
                      )}
                      {u.role !== 'verifier' && (
                        <button className="btn-found"
                          onClick={() => changeRole(u._id, 'verifier')}>Verificador</button>
                      )}
                      {u.role !== 'user' && (
                        <button className="btn-dismiss"
                          onClick={() => changeRole(u._id, 'user')}>Quitar Rol</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5}><EmptyState message="No hay usuarios registrados" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ═══ Vista: Solicitudes de verificación ═══ */
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
                    <NameCell name={v.user?.name || 'Desconocido'}
                      photoUrl={v.user?.picture}
                      detail={v.user?.email}
                      size={36} />
                  </td>
                  <td>{v.notes || '-'}</td>
                  <td>
                    {v.evidenceUrl
                      ? <a href={v.evidenceUrl} target="_blank" rel="noreferrer">Ver Archivo</a>
                      : '-'}
                  </td>
                  <td>
                    <span className={`admin-badge ${v.status === 'approved' ? 'found' : v.status === 'rejected' ? 'missing' : 'pending'}`}>
                      {v.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {v.status === 'pending' && (
                      <div className="action-buttons">
                        <button className="btn-found"
                          onClick={() => changeVerificationStatus(v._id, 'approved')}>Aprobar</button>
                        <button className="btn-dismiss"
                          onClick={() => changeVerificationStatus(v._id, 'rejected')}>Rechazar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {verifications.length === 0 && (
                <tr><td colSpan={5}><EmptyState message="No hay solicitudes de verificación" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
