import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Logo-símbolo oficial "Reencuentros Venezuela": alas azul/amarillo,
 * corazón rojo y estrella blanca (brand book 30/06). SVG limpio y escalable.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 58 52"
    fill="none"
    role="img"
    aria-label="Reencuentros Venezuela"
    className={className}
    style={{ flex: '0 0 auto' }}
  >
    {/* Ala amarilla */}
    <rect x="6" y="9" width="31" height="36" rx="10" fill="#FFC107"
      transform="rotate(-42 21.5 27)" opacity="0.95" />
    {/* Ala azul */}
    <rect x="21" y="9" width="31" height="36" rx="10" fill="#0D47A1"
      transform="rotate(42 36.5 27)" opacity="0.95" />
    {/* Corazón rojo */}
    <path
      d="M29 46 C15 35 6 27 6 16 C6 9 11 5 17 5 C23 5 27 10 29 14 C31 10 35 5 41 5 C47 5 52 9 52 16 C52 27 43 35 29 46 Z"
      fill="#E52520"
    />
    {/* Estrella blanca */}
    <path
      d="M29 14 L31.6 21.2 L39.2 21.4 L33.1 26 L35.4 33.4 L29 28.9 L22.6 33.4 L24.9 26 L18.8 21.4 L26.4 21.2 Z"
      fill="#FFFFFF"
    />
  </svg>
);
