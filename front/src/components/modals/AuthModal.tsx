import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../../services/api';
import { useAuth } from '../../store/AuthContext';
import './ReportModal.css'; // Reusing some modal styles

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { login, user, token } = useAuth();
  
  // States
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Profile Form States
  const [sector, setSector] = useState(user?.sector || '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');

  const needsProfileCompletion = user && !user.isProfileComplete;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setIsSubmitting(true);
      setError('');
      const res = await api.post('/auth/google', { token: credentialResponse.credential });
      login(res.data.token, res.data.user);
      
      if (res.data.user.isProfileComplete) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sector.trim() || !contactNumber.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      // Update profile
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.post('/auth/profile', { sector, contactNumber });
      
      login(res.data.token, res.data.user); // updates token and user
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Error al guardar el perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay">
      <div className="report-modal-content" role="dialog" aria-modal="true" style={{ maxWidth: '400px' }}>
        <header className="report-modal-header">
          <h2 className="report-modal-title">
            {needsProfileCompletion ? 'Completa tu Perfil' : 'Iniciar Sesión'}
          </h2>
          {!isSubmitting && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={24} />
            </button>
          )}
        </header>

        <div className="report-modal-body">
          {error && (
            <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {!user ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--clr-text-muted)' }}>
                Para reportar a una persona o mascota, por favor inicia sesión. Esto nos ayuda a evitar reportes duplicados y a contactarte si hay novedades.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Login Failed')}
                />
              </div>
            </div>
          ) : needsProfileCompletion ? (
            <form onSubmit={handleProfileSubmit}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--clr-text-muted)', fontSize: '0.9rem' }}>
                Antes de reportar, necesitamos un par de datos adicionales para poder contactarte en caso de encontrar coincidencias.
              </p>
              <div className="form-group">
                <label>Sector / Ubicación donde te encuentras</label>
                <input 
                  type="text" 
                  value={sector} 
                  onChange={(e) => setSector(e.target.value)} 
                  placeholder="Ej: La Guaira, Caribe" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Número de Contacto (WhatsApp preferiblemente)</label>
                <input 
                  type="text" 
                  value={contactNumber} 
                  onChange={(e) => setContactNumber(e.target.value)} 
                  placeholder="Ej: +58 412 1234567" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit" disabled={isSubmitting} style={{ width: '100%' }}>
                  {isSubmitting ? (
                    <><Loader2 size={18} className="spinner" /> Guardando...</>
                  ) : (
                    'Guardar y Continuar'
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};
