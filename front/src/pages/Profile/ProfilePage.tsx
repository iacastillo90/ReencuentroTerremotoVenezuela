import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { api } from '../../services/api';
import type { Person } from '../../types';
import { User, Mail, Phone, MapPin, Clock, ArrowRight, LogOut, FileText, ShieldAlert, CheckCircle, MessageCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './Profile.css';

interface ProfilePageProps {
  onSelectPerson: (p: Person) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectPerson }) => {
  const { user, logout } = useAuth();
  const [myReports, setMyReports] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/verification-request', { notes: requestNotes });
      alert('Solicitud enviada correctamente. Un moderador la revisará pronto.');
      setShowRequestForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al enviar la solicitud');
    }
  };

  useEffect(() => {
    const fetchMyReports = async () => {
      try {
        const res = await api.get<Person[]>('/persons/mine');
        setMyReports(res.data);
        const msgs = await api.get('/contacts/received');
        setMessages(msgs.data);
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchMyReports();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="profile-page flex-center">
        <p>Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-large">
          <User size={48} color="var(--clr-primary)" />
        </div>
        <h2>{user.name}</h2>
        <div className="profile-contact-info">
          <span><Mail size={14} /> {user.email}</span>
          {user.contactNumber && <span><Phone size={14} /> {user.contactNumber}</span>}
          {user.sector && <span><MapPin size={14} /> {user.sector}</span>}
        </div>
        
        <button className="btn-logout" onClick={logout}>
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>

      {user.role === 'user' && (
        <div className="profile-content profile-role-card profile-role-user">
          <h3 className="profile-role-title">
            <ShieldAlert size={20} /> Solicitar Acceso de Verificador
          </h3>
          <p className="profile-role-desc">
            Si eres periodista, miembro de ONG o personal en terreno, puedes solicitar acceso a datos de refugios e información de contacto directo de los desaparecidos encontrados.
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
                className="profile-textarea"
              />
              <div className="profile-form-actions">
                <Button type="submit">
                  Enviar Solicitud
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {user.role === 'verifier' && (
        <div className="profile-content profile-role-card profile-role-verifier">
          <h3 className="profile-role-title-success">
            <CheckCircle size={20} /> Cuenta Verificada (Periodista / ONG)
          </h3>
          <p className="profile-role-desc">
            Tienes acceso completo a la información de contacto y ubicaciones exactas para facilitar reencuentros seguros.
          </p>
        </div>
      )}

      <div className="profile-content">
        <h3><MessageCircle size={18} /> Mensajes Recibidos ({messages.length})</h3>
        {messages.length === 0 ? (
          <div className="profile-empty">
            <p>No tienes mensajes de la comunidad.</p>
          </div>
        ) : (
          <div className="my-reports-list">
            {messages.map(msg => (
              <div key={msg._id} className="report-card report-card-message">
                <div className="report-card-header">
                  <h4>Mensaje sobre reporte: {msg.reportId}</h4>
                  <span className={`status-badge found`}>Nuevo</span>
                </div>
                <div className="report-card-body">
                  <p><Clock size={12} /> {new Date(msg.createdAt).toLocaleDateString('es-VE')}</p>
                  <p className="report-desc report-message-text">
                    "{msg.message}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-content">
        <h3><FileText size={18} /> Mis reportes ({myReports.length})</h3>
        
        {loading ? (
          <div className="profile-loading">Cargando reportes...</div>
        ) : myReports.length === 0 ? (
          <div className="profile-empty">
            <p>Aún no has creado ningún reporte.</p>
          </div>
        ) : (
          <div className="my-reports-list">
            {myReports.map(person => (
              <div key={person.idHash} className="report-card" onClick={() => onSelectPerson(person)}>
                <div className="report-card-header">
                  <h4>{person.name}</h4>
                  <span className={`status-badge ${person.status === 'missing' ? 'missing' : 'found'}`}>
                    {person.status === 'missing' ? 'En búsqueda' : 'Encontrado'}
                  </span>
                </div>
                <div className="report-card-body">
                  <p><Clock size={12} /> Actualizado: {new Date(person.metadata.createdAt || '').toLocaleDateString('es-VE')}</p>
                  <p className="report-desc">{person.lastSeen?.description || person.description}</p>
                </div>
                <div className="report-card-footer">
                  <span>Ver detalles <ArrowRight size={14} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
