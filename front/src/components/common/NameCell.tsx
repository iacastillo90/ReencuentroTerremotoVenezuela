/**
 * NameCell.tsx — Celda de nombre con foto y detalle
 *
 * PROPÓSITO:
 *   Renderiza el nombre de una persona con su foto de perfil
 *   (o un placeholder con ícono User) y un detalle opcional
 *   debajo (cédula, origen, etc.).
 *
 * POR QUÉ UN COMPONENTE:
 *   Originalmente este patrón se repetía 7+ veces en el
 *   AdminDashboard. Al extraerlo, reducimos código duplicado
 *   y aseguramos consistencia visual.
 *
 * CÓMO USAR:
 *   <NameCell name="Juan Pérez" photoUrl="..." detail="C.I: 12.345.678" />
 *   <NameCell name="María García" size={40} />
 */
import React from 'react';
import { User } from 'lucide-react';

interface NameCellProps {
  /** Nombre completo de la persona */
  name: string;
  /** URL de la foto (opcional — si no hay, muestra placeholder) */
  photoUrl?: string;
  /** Texto secundario (ej: cédula, origen, fecha) */
  detail?: string;
  /** Tamaño del thumbnail en px (default: 32) */
  size?: number;
}

export const NameCell: React.FC<NameCellProps> = ({ name, photoUrl, detail, size = 32 }) => (
  <div className="name-cell">
    {photoUrl ? (
      // Si hay foto, la muestra con el tamaño especificado.
      <img src={photoUrl} alt={name} className="person-thumb"
        style={{ width: size, height: size }} />
    ) : (
      // Placeholder: un círculo gris con el ícono User.
      <div className="person-thumb-placeholder"
        style={{ width: size, height: size }}>
        <User size={Math.round(size * 0.5)} />
      </div>
    )}
    <div>
      {/* Nombre en negrita */}
      <strong>{name}</strong>
      {/* Detalle opcional en gris muted */}
      {detail && <><br /><small className="admin-text-muted">{detail}</small></>}
    </div>
  </div>
);
