/**
 * components/ui/Button.tsx — Botón reutilizable (design system)
 *
 * PROPÓSITO:
 *   Botón con variantes visuales definidas en el design system.
 *   Es el componente de botón principal de toda la app.
 *
 * VARIANTES:
 *   - primary:   fondo azul (acción principal).
 *   - secondary: fondo gris oscuro (acción secundaria).
 *   - outline:   borde sin fondo (acción terciaria).
 *   - ghost:     sin borde ni fondo (hover sutil).
 *   - danger:    fondo rojo (acción destructiva).
 *
 * TAMAÑOS:
 *   - sm: pequeño (botones inline, pills).
 *   - md: mediano (default).
 *   - lg: grande (botones full-width en móvil).
 *
 * PROPS ADICIONALES:
 *   - fullWidth: ocupa el 100% del ancho del contenedor.
 *   - Todas las props nativas de <button> (onClick, disabled, etc.)
 *
 * USO:
 *   <Button variant="primary" size="sm" onClick={handleClick}>
 *     Guardar
 *   </Button>
 */
import React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children, variant = 'primary', size = 'md',
  fullWidth = false, className = '', ...props
}) => {
  const classNames = [
    styles.btn, styles[`btn-${variant}`], styles[`btn-${size}`],
    fullWidth ? styles['btn-full'] : '', className
  ].filter(Boolean).join(' ');

  return <button className={classNames} {...props}>{children}</button>;
};
