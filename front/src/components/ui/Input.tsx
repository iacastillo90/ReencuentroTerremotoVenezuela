import React from 'react';
import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`input-group ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input 
        className={`input-field ${error ? 'input-error' : ''}`} 
        {...props} 
      />
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
};
