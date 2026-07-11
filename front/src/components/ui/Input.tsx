/**
 * components/ui/Input.tsx — Input de texto reutilizable
 *
 * PROPÓSITO:
 *   Input de texto con label opcional y mensaje de error.
 *   Envuelve el <input> nativo con estilos del design system.
 *
 * CARACTERÍSTICAS:
 *   - Label flotante sobre el input (opcional).
 *   - Mensaje de error debajo del input (rojo).
 *   - Clase .input-error cuando hay error (borde rojo).
 *   - Hereda todas las props de <input> (type, placeholder, etc.).
 *
 * USO:
 *   <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
 *   <Input label="Email" type="email" error="Correo inválido" />
 */
import React from 'react';
import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label, error, className = '', ...props
}) => {
  return (
    <div className={`input-group ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input className={`input-field ${error ? 'input-error' : ''}`} {...props} />
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
};
