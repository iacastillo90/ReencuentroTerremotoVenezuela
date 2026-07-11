/**
 * SectionResumen.tsx — Tarjetas de resumen con conteos
 *
 * PROPÓSITO:
 *   Muestra 4 tarjetas (desaparecidos, encontrados, pendientes,
 *   reportes manuales) con íconos de colores y números grandes.
 *   Es la sección por defecto al entrar al panel admin.
 *
 * DATOS:
 *   Recibe counts de AdminDashboard (que los obtiene de
 *   /persons/counts). Si counts es null (aún cargando),
 *   no renderiza nada.
 *
 * COLORES:
 *   - Rojo (desaparecidos): urgencia.
 *   - Verde (encontrados): éxito.
 *   - Ámbar (pendientes): atención.
 *   - Azul (manuales IA): neutral/informativo.
 *
 * NOTA: Los colores se aplican mediante clases CSS
 * (.red, .green, .amber, .blue) definidas en AdminDashboard.css.
 */
import { Users, CheckCircle, AlertTriangle, GitMerge } from 'lucide-react';
import type { AdminCounts } from '../types';

interface Props { counts: AdminCounts | null }

export function SectionResumen({ counts }: Props) {
  // No renderiza nada hasta que los datos lleguen.
  if (!counts) return null;

  return (
    <div className="admin-stats-row">
      {/* Desaparecidos — rojo */}
      <div className="admin-stat-card">
        <div className="admin-stat-icon red"><Users size={22} /></div>
        <div>
          <h4>{(counts.missing || 0).toLocaleString()}</h4>
          <p>Personas Desaparecidas</p>
        </div>
      </div>

      {/* Encontrados — verde */}
      <div className="admin-stat-card">
        <div className="admin-stat-icon green"><CheckCircle size={22} /></div>
        <div>
          <h4>{(counts.found || 0).toLocaleString()}</h4>
          <p>Personas Encontradas</p>
        </div>
      </div>

      {/* Pendientes — ámbar */}
      <div className="admin-stat-card">
        <div className="admin-stat-icon amber"><AlertTriangle size={22} /></div>
        <div>
          <h4>{(counts.pending || 0).toLocaleString()}</h4>
          <p>Pendientes de Revisión</p>
        </div>
      </div>

      {/* Reportes manuales — azul */}
      <div className="admin-stat-card">
        <div className="admin-stat-icon blue"><GitMerge size={22} /></div>
        <div>
          <h4>{(counts.manual || 0).toLocaleString()}</h4>
          <p>Reportes Manuales (IA)</p>
        </div>
      </div>
    </div>
  );
}
