/**
 * types.ts — Tipos compartidos del panel de administración
 *
 * PROPÓSITO:
 *   Define las interfaces y tipos que usan los componentes
 *   del AdminDashboard. Separarlos aquí evita:
 *   - Importaciones circulares entre secciones.
 *   - Definir los mismos tipos en cada section.
 *
 * TIPOS:
 *   PersonRow: fila de la tabla de registros. Viene del
 *     endpoint /admin/persons con campos planos y anidados
 *     (ej: 'lastSeen.state' y lastSeen.state coexisten).
 *   AdminCounts: estadísticas del resumen.
 *   AdminSection: unión de strings para las 6 secciones.
 */

/**
 * PersonRow: fila de persona en la tabla admin.
 *
 * NOTA: La API /admin/persons devuelve los campos de
 * lastSeen y metadata tanto planos ('lastSeen.state')
 * como anidados (lastSeen: { state }). Esto es porque
 * algunos registros vienen de la base de datos directa
 * y otros de un agregado de MongoDB que desnormaliza.
 * El componente maneja ambos casos con el operador ||.
 */
export interface PersonRow {
  _id: string;
  name: string;
  status: string;
  photoUrl?: string;
  age?: number;
  lastSeen?: { state: string; description: string; municipality?: string; date?: string };
  'lastSeen.state'?: string;
  'metadata.urgencyScore'?: number;
  'metadata.auditStatus'?: string;
  'metadata.source'?: string;
  metadata?: { urgencyScore: number; auditStatus: string; source: string; reportedBy?: Record<string, unknown> };
  data?: { cedula?: string };
  idHash: string;
  contactPerson?: { name?: string; phone?: string; relationship?: string };
  type?: string;
  gender?: string;
  aliases?: string[];
  description?: string;
}

/**
 * AdminCounts: conteos para las tarjetas del resumen.
 *   - missing: personas desaparecidas.
 *   - found: personas encontradas (localizados incluidos).
 *   - pending: reportes pendientes de revisión.
 *   - manual: reportes creados manualmente (vs API de scrapers).
 */
export interface AdminCounts {
  missing: number;
  found: number;
  pending: number;
  manual: number;
  total?: number;
}

/**
 * AdminSection: las 6 vistas del panel admin.
 * Se usa tanto para el estado (useState<AdminSection>)
 * como para el tipado de NAV_ITEMS.
 */
export type AdminSection = 'resumen' | 'matches' | 'registros' | 'busquedas' | 'moderacion' | 'usuarios' | 'colas' | 'auditoria';
