/**
 * pages/Auth/LoginPage.tsx — Página de inicio de sesión
 *
 * PROPÓSITO:
 *   Formulario de login con email + contraseña, más botones
 *   de autenticación social (Google, Apple próximamente).
 *   Es una página independiente (no un modal) porque el flujo
 *   de autenticación es más complejo que solo "loguearse para reportar".
 *
 * FLUJO:
 *   1. Usuario ingresa email + contraseña.
 *   2. Submit → POST /auth/login → backend fija cookie httpOnly.
 *   3. El contexto AuthContext.login(usuario) actualiza el estado global.
 *   4. onSuccess() → redirige a la vista anterior (App.tsx maneja el ruteo).
 *
 * SEGURIDAD:
 *   - La contraseña se envía en texto plano sobre HTTPS (estándar).
 *   - El backend establece una cookie httpOnly (no accesible desde JS).
 *   - Nunca almacenamos el password en el frontend.
 *
 * GOOGLE LOGIN:
 *   El botón de Google redirige al flujo de Google OAuth (no usa
 *   @react-oauth/google aquí, sino un botón personalizado que llama
 *   a onGoogle() en el padre, que abre una nueva página de Google).
 *
 * BYPASS:
 *   - Apple: deshabilitado con clase "disabled" (próximamente).
 */
import React, { useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/AuthContext';
import { humanizeError } from '../../utils/humanizeError';
import { Button } from '../../components/ui/Button';
import { BrandMark } from '../../components/BrandMark';
import { MobileBottomNav } from '../../layouts/MobileBottomNav';
import './Auth.css';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.126 3.805 3.064 1.52-.06 2.115-.98 3.96-.98 1.815 0 2.378.98 3.96.95 1.64-.03 2.65-1.513 3.636-2.96 1.144-1.673 1.615-3.296 1.64-3.376-.03-.013-3.167-1.213-3.2-4.838-.028-3.037 2.478-4.516 2.593-4.587-1.43-2.086-3.64-2.372-4.43-2.413-2.046-.11-4.04 1.306-4.562 1.306v-.23zM15.42 4.148c.834-1.01 1.4-2.415 1.246-3.82-.121.036-1.636.81-2.493 1.838-.767.925-1.396 2.355-1.221 3.74.152.035 1.636-.74 2.468-1.758z"/>
  </svg>
);

interface LoginPageProps {
  onSuccess: () => void;
  onGoRegister: () => void;
  onGoogle: () => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onGoRegister, onGoogle, onBack }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Ingresa tu correo y contraseña.'); return; }
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      login(res.data.user);
      onSuccess();
    } catch (err: any) {
      setError(humanizeError(err, 'No se pudo iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--clr-bg)' }}>
      <nav className="navbar" style={{ position: 'relative' }}>
        <div className="nav-left">
          <button className="nav-brand" onClick={onBack} aria-label="Volver">
            <BrandMark size={34} />
            <span className="nav-brand-text">
              <strong>Reencuentros<span>Venezuela</span></strong>
              <small>Juntos te encontramos</small>
            </span>
          </button>
        </div>
      </nav>

      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Iniciar sesión</h1>

        <div className="auth-info-card">
          <div className="auth-info-icon">
            <Info size={20} strokeWidth={2} />
          </div>
          <div className="auth-info-content">
            <strong>Información importante</strong>
            <p>Por seguridad para reportar un caso o buscar a una persona/mascota debes estar registrado y formar parte de una organización certificada.</p>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-field">
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="auth-field">
            <input type={showPw ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} aria-label="Mostrar contraseña">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="auth-forgot-wrap">
            <button type="button" className="auth-link-right" onClick={() => alert('Recuperación de contraseña: próximamente.')}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-submit-wrap">
            <Button fullWidth type="submit" disabled={loading} size="lg" className="auth-submit-btn">
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </div>
        </form>

        <div className="auth-divider"><span>O continúa con</span></div>
        <div className="auth-social">
          <button className="auth-social-btn" onClick={onGoogle}>
            <GoogleIcon /> Google
          </button>
          <button className="auth-social-btn disabled" disabled title="Próximamente">
            <AppleIcon /> Apple
          </button>
        </div>

        <div className="auth-foot-wrapper">
          <p className="auth-foot">¿No tienes cuenta? <button className="auth-link" onClick={onGoRegister}>Crear cuenta</button></p>
        </div>
      </div>

        <div className="auth-mobile-nav-wrapper">
          <MobileBottomNav
            activeView="login"
            onNavigate={(v) => { if (v === 'home') onBack(); }}
            onReport={() => {}}
          />
        </div>
      </div>
    </div>
  );
};
