import { BadgeCheck, Radio, Building2 } from 'lucide-react';
import './Directory.css';

interface Org {
  id: string;
  name: string;
  specialty: string;
  channel: string;
  channelRole: string;
}

const ORGS: Org[] = [
  { id: 'PC-VEN-001', name: 'Protección Civil Nacional', specialty: 'Rescate y búsqueda urbana', channel: 'Canal de coordinación PC', channelRole: 'Coordinador de operaciones' },
  { id: 'BOM-DTC-002', name: 'Bomberos Distrito Capital', specialty: 'Rescate técnico y estructuras colapsadas', channel: 'Canal de coordinación Bomberos', channelRole: 'Comandante de guardia' },
  { id: 'CR-VEN-003', name: 'Cruz Roja Venezolana', specialty: 'Atención médica y albergues', channel: 'Canal de coordinación Cruz Roja', channelRole: 'Líder de respuesta humanitaria' },
  { id: 'NEV-VEN-004', name: 'Noticiero Emergencia VE', specialty: 'Registro y verificación de campo', channel: 'Canal de coordinación Noticiero', channelRole: 'Editor de mesa técnica' },
  { id: 'KSAR-VEN-005', name: 'Brigada Rescate K-SAR', specialty: 'Búsqueda con caninos', channel: 'Canal de coordinación K-SAR', channelRole: 'Jefe de brigada' },
  { id: 'FUN-ANI-006', name: 'Bienestar Animal VE', specialty: 'Rescate y triaje de fauna', channel: 'Canal de coordinación Fauna', channelRole: 'Coordinador de campo' },
];

interface DirectoryPageProps {
  onNavigate?: (view: any) => void;
}

export function DirectoryPage({ onNavigate }: DirectoryPageProps) {
  return (
    <div className="directory-page page-content narrow">
      <header className="directory-hero">
        <span className="directory-hero-ico"><Building2 size={26} /></span>
        <div>
          <p className="eyebrow">Fuentes verificadas</p>
          <h2>Directorio de apoyo</h2>
          <p className="directory-hero-sub">Organizaciones autorizadas y puntos de control de emergencia coordinados. Solo estas instituciones pueden publicar reportes oficiales.</p>
        </div>
      </header>

      <div className="directory-grid">
        {ORGS.map(org => (
          <article 
            key={org.id} 
            className="org-card surface-card" 
            onClick={() => onNavigate?.('library')}
            style={{ cursor: 'pointer' }}
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
