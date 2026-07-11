/**
 * EmptyState.tsx — Estado vacío genérico
 *
 * PROPÓSITO:
 *   Muestra un mensaje amigable cuando una lista/tabla/búsqueda
 *   no tiene resultados. Reemplaza los patrones duplicados de
 *   AdminDashboard, ProfilePage, Feed, SearchPage.
 *
 * CÓMO USAR:
 *   <EmptyState message="No hay reportes pendientes" />
 *   <EmptyState message="Sin resultados" subtext="Intenta con otros filtros" />
 *
 * NOTA:
 *   No necesita íconos — el mensaje claro y el subtexto opcional
 *   son suficientes. Si en el futuro se quiere un ícono, se puede
 *   agregar como prop opcional.
 */
import React from 'react';

interface EmptyStateProps {
  /** Mensaje principal (ej: "No se encontraron resultados") */
  message: string;
  /** Subtítulo opcional con más contexto */
  subtext?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, subtext }) => (
  <div className="admin-table-empty">
    <p>{message}</p>
    {subtext && <small className="admin-text-muted">{subtext}</small>}
  </div>
);
