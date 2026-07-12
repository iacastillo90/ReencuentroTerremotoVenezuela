/**
 * AdminDashboard.tsx — Panel de administración (layout + navegación)
 *
 * PROPÓSITO:
 *   Layout completo del panel admin con sidebar de navegación,
 *   topbar con título, y un área de contenido que renderiza
 *   la sección activa. Es full-screen: no usa AppLayout.
 *
 * ESTRUCTURA:
 *   <aside> → sidebar con logo + nav items + botón volver
 *   <main>  → topbar + contenido dinámico
 *
 * SECCIONES:
 *   Cada sección es un componente independiente en ./sections/:
 *   - Resumen: cards con conteos totales.
 *   - Moderación: reportes manuales pendientes de revisión.
 *   - Matches: auditoría de fusiones IA.
 *   - Registros: tabla con búsqueda y cambio de estado.
 *   - Búsquedas: solicitudes de familias.
 *   - Usuarios: gestión de roles y verificación.
 *
 * CARGA INICIAL:
 *   useEffect llama /admin/persons y /persons/counts en paralelo
 *   al montar. Los datos se pasan a las secciones que los
 *   necesitan (resumen, registros).
 */
import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import {
  LayoutDashboard, Users, ShieldCheck,
  Search, ShieldAlert, ArrowLeft, Activity
} from 'lucide-react';
import { api } from '../../services/api';
import type { PersonRow, AdminCounts, AdminSection } from './types';
import { SectionResumen } from './sections/SectionResumen';
import { SectionRegistros } from './sections/SectionRegistros';
import { SectionBusquedas } from './sections/SectionBusquedas';
import { SectionModeracion } from './sections/SectionModeracion';
import { SectionMatches } from './sections/SectionMatches';
import { SectionUsuarios } from './sections/SectionUsuarios';
import './AdminDashboard.css';
import '../Profile/Profile.css';

interface AdminDashboardProps {
  onBack: () => void;
}

/**
 * NAV_ITEMS: define las secciones del panel.
 * Cada item tiene:
 *   key: nombre único (coincide con AdminSection).
 *   label: texto visible en la sidebar.
 *   Icon: componente de Lucide (se instancia en el JSX).
 *
 * NOTA: Guardamos el componente (Icon), no JSX (<Icon size={18} />),
 * para evitar la advertencia de React jsx-key (cada item tendría
 * su propia key implícita en el map).
 */
const NAV_ITEMS: { key: AdminSection; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'resumen',    label: 'Resumen General',    Icon: LayoutDashboard },
  { key: 'moderacion', label: 'Moderación (Nuevos)', Icon: ShieldAlert },
  { key: 'matches',    label: 'Auditoría de Matches', Icon: Search },
  { key: 'registros',  label: 'Control Registros',  Icon: ShieldCheck },
  { key: 'busquedas',  label: 'Solicitudes (Familias)', Icon: Search },
  { key: 'usuarios',   label: 'Usuarios (Roles)',   Icon: Users },
  { key: 'colas',      label: 'Colas (BullMQ)',     Icon: Activity },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  // ─── Estado ─────────────────────────────────────────
  // activeSection: qué sección se muestra (default 'resumen').
  // persons: lista de personas para la tabla de registros.
  // counts: estadísticas para las cards de resumen.
  // loading: true mientras se cargan los datos iniciales.
  const [activeSection, setActiveSection] = useState<AdminSection>('resumen');
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Carga inicial ──────────────────────────────────
  // Obtiene datos de /admin/persons (lista de personas con
  // metadatos de auditoría) y /persons/counts (conteos).
  // Promise.all para carga en paralelo.
  useEffect(() => {
    Promise.all([
      api.get('/admin/persons?limit=200'),
      api.get('/persons/counts')
    ]).then(([personsRes, countsRes]) => {
      setPersons(personsRes.data || []);
      setCounts(countsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  // ─── handleStatusChange ─────────────────────────────
  // Callback que pasamos a SectionRegistros.
  // Cuando el admin cambia el estado de una persona
  // (missing → found), actualizamos el estado local
  // para que la UI refleje el cambio sin recargar.
  const handleStatusChange = (idHash: string, newStatus: string) => {
    setPersons(prev => prev.map(p =>
      p.idHash === idHash ? { ...p, status: newStatus } : p
    ));
  };

  // Título dinámico de la sección activa (se muestra en la topbar).
  const sectionTitle = {
    resumen: 'Resumen General',
    moderacion: 'Moderación de Reportes',
    matches: 'Revisión y Fusión de Perfiles',
    registros: 'Control de Registros',
    busquedas: 'Búsquedas Activas de Familiares',
    usuarios: 'Gestión de Usuarios y Roles',
    colas: 'Monitoreo de Procesos en Segundo Plano'
  }[activeSection];

  return (
    <div className="admin-layout">
      {/* ═══ Sidebar ═══ */}
      <aside className="admin-sidebar">
        {/* Logo: "ReencuentroVE" con VE destacado */}
        <div className="admin-sidebar-logo">
          <div>
            <h2>Reencuentro<span>VE</span></h2>
            <small>Panel de Administración</small>
          </div>
        </div>

        {/* Navegación: itera NAV_ITEMS y resalta el activo */}
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <div key={key}
            className={`admin-nav-item ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}>
            <Icon size={18} />
            {label}
          </div>
        ))}

        {/* Footer: botón para volver a la app principal */}
        <div className="admin-sidebar-footer">
          <button className="admin-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Volver al Mapa
          </button>
        </div>
      </aside>

      {/* ═══ Main area ═══ */}
      <main className="admin-main">
        {/* Topbar: título + botón volver + metadatos */}
        <header className="admin-topbar">
          <div className="admin-topbar-header-row">
            <h1>{sectionTitle}</h1>
            <button className="admin-back-btn" onClick={onBack}>
              <ArrowLeft size={16} /> Volver
            </button>
          </div>
          <div className="admin-topbar-meta">
            <span>{counts ? (counts.total || 0).toLocaleString() : persons.length} registros totales</span>
          </div>
        </header>

        {/* Contenido dinámico según sección activa */}
        <div className="admin-content">
          <Sentry.ErrorBoundary fallback={<div style={{ padding: '1rem', textAlign: 'center', color: 'var(--clr-text-muted)' }}>Error al cargar la sección.</div>}>
            {activeSection === 'resumen' && <SectionResumen counts={counts} />}
            {activeSection === 'moderacion' && <SectionModeracion />}
            {activeSection === 'matches' && <SectionMatches />}
            {activeSection === 'busquedas' && <SectionBusquedas />}
            {activeSection === 'registros' && (
              <SectionRegistros
                persons={persons}
                loading={loading}
                onStatusChange={handleStatusChange}
              />
            )}
            {activeSection === 'usuarios' && <SectionUsuarios />}
            {activeSection === 'colas' && (
              <div style={{ width: '100%', height: 'calc(100vh - 80px)', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                <iframe
                  src={`${api.defaults.baseURL}/admin/queues?_t=${Date.now()}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Bull-Board Queues"
                />
              </div>
            )}
          </Sentry.ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
