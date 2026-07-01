import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../../services/api';
import { useAuth } from '../../store/AuthContext';
import { Button } from '../ui/Button';
import './ReportModal.css'; // Reusing some modal styles

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { login, user } = useAuth();
  
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';
  const isDevMode = GOOGLE_CLIENT_ID === 'dummy-client-id';
  
  // States
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Profile Form States
  const [sector, setSector] = useState(user?.sector || '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');

  const needsProfileCompletion = user && !user.isProfileComplete;
  const isPendingReview = user?.status === 'pending';

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setIsSubmitting(true);
      setError('');
      const res = await api.post('/auth/google', { token: credentialResponse.credential });
      login(res.data.user);
      
      if (res.data.user.isProfileComplete && res.data.user.status !== 'pending') {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBypassLogin = async () => {
    if (!import.meta.env.DEV) return;

    try {
      const inputEmail = window.prompt("Ingresa un correo para la sesión de prueba (reutiliza el mismo para mantener tu perfil):", "dev@ayudave.com");
      if (!inputEmail) return;

      const safeEmail = inputEmail.trim().toLowerCase();
      const mockId = btoa(safeEmail).replace(/=/g, '');

      setIsSubmitting(true);
      setError('');

      const mockPayload = {
        sub: `dev-${mockId}`,
        email: safeEmail,
        name: `Usuario ${safeEmail.split('@')[0]}`,
        picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockId}`
      };
      const mockToken = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + '.' + btoa(JSON.stringify(mockPayload)) + '.signature';

      const res = await api.post('/auth/google', { token: mockToken });
      login(res.data.user);

      if (res.data.user.isProfileComplete) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión en modo desarrollador.');
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
      const res = await api.post('/auth/profile', { sector, contactNumber });

      login(res.data.user);
      if (res.data.user.status !== 'pending') {
        onSuccess();
      }
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
            {isPendingReview ? 'Verificación Pendiente' : needsProfileCompletion ? 'Completa tu Perfil' : 'Iniciar Sesión'}
          </h2>
          {!isSubmitting && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={24} />
            </button>
          )}
        </header>

        <div className="report-modal-body">
          {error && (
            <div className="auth-modal-error">
              {error}
            </div>
          )}

          {!user ? (
            <div className="auth-modal-login-container">
              <p className="auth-modal-login-text">
                Para reportar a una persona o mascota, por favor inicia sesión. Esto nos ayuda a evitar reportes duplicados y a contactarte si hay novedades.
              </p>
              <div className="auth-modal-login-actions">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Login Failed')}
                />
                
                {isDevMode && (
                  <Button 
                    variant="outline"
                    onClick={handleBypassLogin}
                    disabled={isSubmitting}
                  >
                    Bypass Login (Modo de Desarrollo)
                  </Button>
                )}
              </div>
            </div>
          ) : needsProfileCompletion ? (
            <form onSubmit={handleProfileSubmit}>
              <p className="auth-modal-profile-text">
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
                <Button fullWidth type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 size={18} className="spinner" /> Guardando...</>
                  ) : (
                    'Guardar y Continuar'
                  )}
                </Button>
              </div>
            </form>
          ) : user?.status === 'pending' ? (
            <div className="auth-modal-login-container" style={{ textAlign: 'center', padding: '20px' }}>
              <h3 style={{ color: '#d97706', marginBottom: '10px' }}>Cuenta en Revisión</h3>
              <p className="auth-modal-login-text">
                Tu cuenta ha sido registrada y actualmente está pendiente de revisión por un moderador para verificar la autenticidad de los datos. Te notificaremos pronto.
              </p>
              <Button fullWidth onClick={onClose} style={{ marginTop: '15px' }}>Entendido</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
