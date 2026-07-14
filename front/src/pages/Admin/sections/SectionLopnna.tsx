import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { LoadingScreen } from '../../../components/common/LoadingScreen';
import { EmptyState } from '../../../components/common/EmptyState';
import { EyeOff, Trash2, CheckCircle, AlertTriangle, User } from 'lucide-react';

interface FlaggedPerson {
  _id: string;
  idHash: string;
  name: string;
  photoUrl?: string;
  age?: number;
  status: string;
  lastSeen?: { state: string; description: string };
  'lastSeen.state'?: string;
  metadata?: {
    containsMinor?: boolean;
    containsMinorAges?: Array<{ age_range: string; age_approx: number }>;
    urgencyScore?: number;
    createdAt?: string;
    source?: string;
  };
  'metadata.containsMinorAges'?: Array<{ age_range: string; age_approx: number }>;
}

export const SectionLopnna: React.FC = () => {
  const [persons, setPersons] = useState<FlaggedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ idHash: string; action: string } | null>(null);

  const loadFlagged = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/lopnna/flagged?limit=200');
      setPersons(res.data.persons || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al cargar fotos sospechosas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlagged();
  }, [loadFlagged]);

  const getAges = (p: FlaggedPerson): Array<{ age_range: string; age_approx: number }> => {
    return p.metadata?.containsMinorAges || (p as any)['metadata.containsMinorAges'] || [];
  };

  const handleAction = async (idHash: string, action: 'blur' | 'delete-photo' | 'false-positive') => {
    setActionLoading(idHash);
    setConfirmAction(null);
    try {
      await api.post(`/admin/lopnna/${idHash}/${action}`);
      setPersons(prev => prev.filter(p => p.idHash !== idHash));
    } catch (err: any) {
      setError(err?.response?.data?.error || `Error al ejecutar acción ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingScreen text="Cargando fotos sospechosas..." />;

  if (error) {
    return (
      <div className="admin-section-fallback">
        <AlertTriangle size={32} />
        <p>{error}</p>
        <button className="admin-back-btn" onClick={loadFlagged} style={{ marginTop: 12 }}>
          Reintentar
        </button>
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <EmptyState
        icon="alert"
        message="Sin alertas LOPNNA"
        subtext="No hay fotos con posibles menores de edad pendientes de revisión."
      />
    );
  }

  return (
    <div className="lopnna-section">
      <div className="lopnna-header">
        <div className="lopnna-stats">
          <span className="lopnna-badge lopnna-badge-warning">
            {persons.length} foto{persons.length !== 1 ? 's' : ''} pendiente{persons.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="lopnna-grid">
        {persons.map(person => {
          const ages = getAges(person);
          return (
            <div key={person._id} className="lopnna-card">
              <div className="lopnna-card-photo">
                {person.photoUrl ? (
                  <img
                    src={person.photoUrl}
                    alt={person.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`lopnna-card-photo-placeholder ${person.photoUrl ? 'hidden' : ''}`}>
                  <User size={48} />
                </div>
                <div className="lopnna-card-overlay">
                  {ages.map((a, i) => (
                    <span key={i} className="lopnna-age-badge">
                      ~{a.age_approx} años
                    </span>
                  ))}
                </div>
              </div>

              <div className="lopnna-card-body">
                <h3>{person.name}</h3>
                <p className="lopnna-card-meta">
                  {person.age && `Edad reportada: ${person.age} años`}
                  {person.lastSeen?.state || (person as any)['lastSeen.state']
                    ? ` · ${person.lastSeen?.state || (person as any)['lastSeen.state']}`
                    : ''}
                </p>
                {ages.length > 0 && (
                  <p className="lopnna-card-ages">
                    IA detectó: {ages.map(a => `${a.age_range} (~${a.age_approx}a)`).join(', ')}
                  </p>
                )}
              </div>

              <div className="lopnna-card-actions">
                {confirmAction?.idHash === person.idHash ? (
                  <div className="lopnna-confirm">
                    <span>Confirmar {confirmAction.action === 'blur' ? 'difuminado' : confirmAction.action === 'delete-photo' ? 'eliminación' : 'falso positivo'}?</span>
                    <div className="lopnna-confirm-btns">
                      <button
                        className="lopnna-btn lopnna-btn-danger lopnna-btn-sm"
                        onClick={() => handleAction(person.idHash, confirmAction.action as any)}
                        disabled={actionLoading === person.idHash}
                      >
                        Sí
                      </button>
                      <button
                        className="lopnna-btn lopnna-btn-secondary lopnna-btn-sm"
                        onClick={() => setConfirmAction(null)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="lopnna-btn lopnna-btn-primary"
                      onClick={() => handleAction(person.idHash, 'blur')}
                      disabled={actionLoading === person.idHash}
                    >
                      <EyeOff size={14} /> Difuminar
                    </button>
                    <button
                      className="lopnna-btn lopnna-btn-danger"
                      onClick={() => setConfirmAction({ idHash: person.idHash, action: 'delete-photo' })}
                      disabled={actionLoading === person.idHash}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                    <button
                      className="lopnna-btn lopnna-btn-success"
                      onClick={() => setConfirmAction({ idHash: person.idHash, action: 'false-positive' })}
                      disabled={actionLoading === person.idHash}
                    >
                      <CheckCircle size={14} /> Falso + 
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
