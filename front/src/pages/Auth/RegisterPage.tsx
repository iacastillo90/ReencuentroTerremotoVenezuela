import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/AuthContext';
import './Auth.css';

interface RegisterPageProps {
  onSuccess: () => void;
  onGoLogin: () => void;
  onBack: () => void;
}

const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess, onGoLogin, onBack }) => {
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', phone: '', country: 'Venezuela',
    state: '', municipality: '', password: '', confirm: '',
  });
  const [checks, setChecks] = useState({ privacy: false, terms: false, responsible: false });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.lastName || !form.email || !form.password) {
      setError('Completa nombre, apellido, correo y contraseña.'); return;
    }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (!checks.privacy || !checks.terms || !checks.responsible) {
      setError('Debes aceptar las políticas para crear la cuenta.'); return;
    }
    try {
      setLoading(true);
      const res = await api.post('/auth/register', {
        name: form.name,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        contactNumber: form.phone ? `+58 ${form.phone}` : undefined,
        country: form.country,
        state: form.state,
        municipality: form.municipality,
      });
      login(res.data.token, res.data.user);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button>
      <div className="auth-card">
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-sub">Completa tus datos para registrarte</p>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-field"><User size={18} /><input placeholder="Nombre" value={form.name} onChange={set('name')} /></div>
          <div className="auth-field"><User size={18} /><input placeholder="Apellido" value={form.lastName} onChange={set('lastName')} /></div>
          <div className="auth-field"><Mail size={18} /><input type="email" placeholder="Correo electrónico" value={form.email} onChange={set('email')} autoComplete="email" /></div>

          <div className="auth-row">
            <div className="auth-field auth-phone"><span style={{ fontSize: '.85rem' }}>🇻🇪 +58</span></div>
            <div className="auth-field"><input type="tel" placeholder="Teléfono" value={form.phone} onChange={set('phone')} /></div>
          </div>

          <label className="auth-label">País</label>
          <div className="auth-field"><select value={form.country} onChange={set('country')}><option>Venezuela</option><option>Colombia</option><option>Otro</option></select></div>

          <label className="auth-label">Estado / Provincia</label>
          <div className="auth-field">
            <select value={form.state} onChange={set('state')}>
              <option value="">Selecciona</option>
              {ESTADOS_VE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <label className="auth-label">Municipio</label>
          <div className="auth-field"><input placeholder="Municipio" value={form.municipality} onChange={set('municipality')} /></div>

          <div className="auth-field">
            <Lock size={18} />
            <input type={showPw ? 'text' : 'password'} placeholder="Contraseña" value={form.password} onChange={set('password')} autoComplete="new-password" />
            <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} aria-label="Mostrar contraseña">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <div className="auth-field"><Lock size={18} /><input type={showPw ? 'text' : 'password'} placeholder="Confirmar contraseña" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></div>

          <div className="auth-checks">
            <label className="auth-check"><input type="checkbox" checked={checks.privacy} onChange={e => setChecks(c => ({ ...c, privacy: e.target.checked }))} /><span>Acepto la <b>Política de Privacidad</b></span></label>
            <label className="auth-check"><input type="checkbox" checked={checks.terms} onChange={e => setChecks(c => ({ ...c, terms: e.target.checked }))} /><span>Acepto los <b>Términos y Condiciones</b></span></label>
            <label className="auth-check"><input type="checkbox" checked={checks.responsible} onChange={e => setChecks(c => ({ ...c, responsible: e.target.checked }))} /><span>Comprendo el uso responsable de la plataforma</span></label>
          </div>

          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta'}</button>
        </form>

        <p className="auth-foot">¿Ya tienes cuenta? <button className="auth-link" onClick={onGoLogin}>Iniciar sesión</button></p>
      </div>
    </div>
  );
};
