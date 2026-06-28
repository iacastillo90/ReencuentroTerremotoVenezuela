import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { api } from '../../services/api';
import type { Person } from '../../types';
import { User, Mail, Phone, MapPin, Clock, ArrowRight, LogOut, FileText } from 'lucide-react';
import './Profile.css';

interface ProfilePageProps {
  onSelectPerson: (p: Person) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectPerson }) => {
  const { user, logout } = useAuth();
  const [myReports, setMyReports] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyReports = async () => {
      try {
        const res = await api.get<Person[]>('/persons/mine');
        setMyReports(res.data);
      } catch (err) {
        console.error('Error fetching my reports', err);
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
