import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/AuthContext';
import './Auth.css';

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
      login(res.data.token, res.data.user);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button>
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-heart">❤</span>
          <div><strong>Reencuentros</strong><small>TERREMOTO VENEZUELA</small></div>
        </div>
        <h1 className="auth-title">Iniciar sesión</h1>
        <p className="auth-sub">Ingresa para continuar</p>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-field">
            <Mail size={18} />
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="auth-field">
            <Lock size={18} />
            <input type={showPw ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} aria-label="Mostrar contraseña">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="button" className="auth-link-right" onClick={() => alert('Recuperación de contraseña: próximamente.')}>
            ¿Olvidaste tu contraseña?
          </button>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
        </form>

        <div className="auth-divider"><span>o continúa con</span></div>
        <div className="auth-social">
          <button className="auth-social-btn" onClick={onGoogle}><span className="g">G</span> Google</button>
          <button className="auth-social-btn disabled" disabled title="Próximamente"> Apple</button>
        </div>

        <p className="auth-foot">¿No tienes cuenta? <button className="auth-link" onClick={onGoRegister}>Crear cuenta</button></p>
        <p className="auth-terms">🔒 Al continuar, aceptas nuestros <b>Términos y Condiciones</b> y <b>Política de Privacidad</b>.</p>
      </div>
    </div>
  );
};
