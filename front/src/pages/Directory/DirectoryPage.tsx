/**
 * pages/Directory/DirectoryPage.tsx — Directorio de organizaciones verificadas
 *
 * PROPÓSITO:
 *   Lista de organizaciones autorizadas que participan en la respuesta
 *   al terremoto. Cada organización tiene un ID único, especialidad,
 *   canal de coordinación y rol.
 *
 * USO:
 *   - Público: muestra qué organizaciones están coordinando.
 *   - Click en una card → navega a LibraryPage (más recursos).
 *
 * ORGANIZACIONES (hardcoded por ahora):
 *   - Protección Civil Nacional (PC-VEN-001)
 *   - Bomberos Distrito Capital (BOM-DTC-002)
 *   - Cruz Roja Venezolana (CR-VEN-003)
 *   - Noticiero Emergencia VE (NEV-VEN-004)
 *   - Brigada Rescate K-SAR (KSAR-VEN-005)
 *   - Bienestar Animal VE (FUN-ANI-006)
 *
 * CADA CARD MUESTRA:
 *   - ID de la organización (código único).
 *   - Badge "Certificado".
 *   - Nombre.
 *   - Especialidad (qué hacen).
 *   - Canal de coordinación + rol.
 */
import { BadgeCheck, Radio, Building2 } from 'lucide-react';
import type { View } from '../../types';
import './Directory.css';

interface Org {
  id: string;
  name: string;
  specialty: string;
  channel: string;
  channelRole: string;
}

const ORGS: Org[] = [
  { id: 'CR-VEN-003', name: 'Cruz Roja Venezolana', specialty: 'Atención médica y albergues', channel: 'Canal de coordinación Cruz Roja', channelRole: 'Líder de respuesta humanitaria' },
  { id: 'NEV-VEN-004', name: 'Noticiero Emergencia VE', specialty: 'Registro y verificación de campo', channel: 'Canal de coordinación Noticiero', channelRole: 'Editor de mesa técnica' },
  { id: 'FUN-ANI-006', name: 'Bienestar Animal VE', specialty: 'Rescate y triaje de fauna', channel: 'Canal de coordinación Fauna', channelRole: 'Coordinador de campo' },
  { id: 'BOM-DTC-002', name: 'Bomberos Distrito Capital', specialty: 'Rescate técnico y estructuras colapsadas', channel: 'Canal de coordinación Bomberos', channelRole: 'Comandante de guardia' },
  { id: 'PC-VEN-001', name: 'Protección Civil Nacional', specialty: 'Rescate y búsqueda urbana', channel: 'Canal de coordinación PC', channelRole: 'Coordinador de operaciones' },
  { id: 'KSAR-VEN-005', name: 'Brigada Rescate K-SAR', specialty: 'Búsqueda con caninos', channel: 'Canal de coordinación K-SAR', channelRole: 'Jefe de brigada' },
];

interface DirectoryPageProps {
  onNavigate?: (view: View) => void;
}

export function DirectoryPage({ onNavigate }: DirectoryPageProps) {
  return (
    <div className="directory-page page-content narrow">
      <header className="directory-hero">
        <span className="directory-hero-ico"><Building2 size={26} /></span>
        <div>
          <p className="eyebrow">Fuentes verificadas</p>
          <h2>Directorio de apoyo</h2>
          <p className="directory-hero-sub">Lista de organizaciones autorizadas y puntos de control de emergencia coordinados.</p>
        </div>
      </header>

      <div className="directory-grid">
        {ORGS.map(org => (
          <article
            key={org.id}
            className="org-card surface-card"
            onClick={() => onNavigate?.('library')}
          >
            <div className="org-card-top">
              <span className="org-id">{org.id}</span>
              <span className="badge verified"><BadgeCheck size={13} /> Certificado</span>
            </div>
            <h3>{org.name}</h3>
            <p className="org-specialty">{org.specialty}</p>
            <div className="org-channel">
              <Radio size={15} />
              <span><strong>{org.channel}</strong><small>{org.channelRole}</small></span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
