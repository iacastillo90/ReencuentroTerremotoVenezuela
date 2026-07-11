/**
 * LoadingScreen.tsx — Pantalla de carga genérica
 *
 * PROPÓSITO:
 *   Componente reutilizable para mostrar un spinner + mensaje
 *   mientras se cargan datos. Se usa en AdminDashboard, Feed,
 *   ProfilePage, ReportModal y cualquier otra vista que
 *   necesite indicar carga.
 *
 * POR QUÉ UN COMPONENTE:
 *   Antes de refactorizar, cada página tenía su propio
 *   <Loader2 className="spinner" /> + <span> repetido.
 *   Este componente unifica la apariencia y evita duplicación.
 *
 * CÓMO USAR:
 *   <LoadingScreen text="Cargando reportes..." size={32} />
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  /** Texto que se muestra junto al spinner (default: "Cargando...") */
  text?: string;
  /** Tamaño del icono spinner en px (default: 24) */
  size?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ text = 'Cargando...', size = 24 }) => (
  <div className="admin-loading">
    {/* Loader2 es el icono de spinner de Lucide.
        La clase .spinner (definida en index.css) aplica
        la animación de rotación infinita con @keyframes spin. */}
    <Loader2 className="spinner" size={size} />
    <span>{text}</span>
  </div>
);
