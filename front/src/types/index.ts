/**
 * ═══════════════════════════════════════════════════════════
 * types/index.ts — Tipos compartidos de toda la aplicación
 * 
 * PROPÓSITO:
 *   Define las interfaces de datos que se usan en múltiples
 *   componentes. Centralizar los tipos aquí evita:
 *   - Duplicación (cada componente re-definiendo Person).
 *   - Inconsistencias (un campo string aquí, optional allá).
 *   - Importaciones circulares (todos importan de un solo lugar).
 * 
 * CONVENCIÓN:
 *   - Usamos `interface` en lugar de `type` para objetos
 *     (mejor mensaje de error en TypeScript).
 *   - Los campos opcionales (?) son los que pueden venir
 *     null desde la API.
 *   - type Person = ... NO es un enum (erasableSyntaxOnly
 *     en tsconfig no permite enums).
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Persona reportada como desaparecida o encontrada.
 * 
 * Es la interfaz más importante de la app — aparece en:
 *   - Feed (lista infinita)
 *   - Mapa (marcadores)
 *   - Modal de detalle (PersonDetailModal)
 *   - Admin (tablas de registros)
 *   - Profile (matches del usuario)
 * 
 * CAMPO POR CAMPO:
 *   idHash: identificador único. Para personas de /persons
 *     es el hash SHA del backend. Para /localizados lleva
 *     prefijo 'loc-' (ver App.tsx fetchPersons).
 *   type: 'person' (default) o 'animal' (mascotas perdidas).
 *   name: nombre completo (o descripción para animales).
 *   status: estado actual — 'missing', 'found', 'deceased',
 *     'unknown'. Determina el color del badge y el ícono.
 *   lastSeen.state: estado de Venezuela donde se vio por
 *     última vez (ej: "Lara", "Miranda"). También usado
 *     para filtrar en el mapa.
 *   lastSeen.description: texto libre (ej: "Visto en: Hospital
 *     Central de Maracaibo").
 *   lastSeen.municipality: municipio específico (filtro más
 *     granular que state).
 *   lastSeen.date: fecha ISO de la última vez visto.
 *   lastSeen.coordinates: [lng, lat] para el marcador del mapa.
 *     Dentro de un objeto coordinates para compatibilidad con
 *     GeoJSON de MongoDB.
 *   age: edad aproximada (puede no saberse).
 *   gender: 'male' | 'female' | 'other' | undefined.
 *   description: señas particulares (cicatriz, tatuaje, ropa).
 *   photoUrl: URL de la foto (puede ser de Google Storage
 *     o Unsplash). Las fotos de menores se difuminan con
 *     .protected-media (ver index.css).
 *   metadata.urgencyScore: 0-10, qué tan urgente es encontrar
 *     a esta persona (calculado por IA: días desaparecido,
 *     edad, condiciones de salud).
 *   metadata.createdAt: fecha de creación del reporte.
 *   metadata.reportedBy: quien reportó (nombre).
 *   data.cedula: cédula de identidad (solo para venezolanos).
 *   data.ficha_url: enlace a la ficha oficial si existe.
 *   data.origen: "Reporte Hospital/Refugio" o "Reporte Familiar".
 *   data.verificado_por: si está verificado, quién lo verificó.
 */
export interface Person {
  idHash: string;
  type?: 'person' | 'animal';
  name: string;
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    state: string;
    description: string;
    municipality?: string;
    date?: string;
    coordinates?: {
      coordinates: [number, number];
    }
  };
  age?: number;
  gender?: string;
  description?: string;
  photoUrl?: string;
  metadata: {
    urgencyScore: number;
    createdAt?: string;
    reportedBy?: { name: string };
  };
  data?: {
    cedula?: string;
    ficha_url?: string;
    origen?: string;
    verificado_por?: string;
  };
}

/**
 * Desastre natural activo.
 * 
 * Se muestra en:
 *   - Mapa (capa de desastres con colores por severidad).
 *   - FeedSidebar (lista de desastres recientes).
 *   - LogisticsPage (apoyo logístico por desastre).
 * 
 * severity determina el color en el mapa:
 *   low → verde, medium → amarillo, high → naranja, critical → rojo.
 * 
 * coordinates usa el formato GeoJSON [lng, lat] para
 * compatibilidad directa con MongoDB $nearSphere.
 */
/**
 * Solicitud de búsqueda reportada por un familiar (panel admin).
 *
 * Corresponde al modelo SearchRequest del backend en /admin/searches.
 * Cada solicitud representa un reporte de búsqueda creado por un
 * familiar desde la interfaz de ReportModal.
 *
 * status:
 *   'activa'   → búsqueda en curso (default).
 *   'resuelta' → la persona fue localizada.
 *   'cerrada'  → la búsqueda se desactivó sin resolución.
 *
 * user: objeto poblado (populate) desde la API; si el usuario fue
 * eliminado, se muestra "Desconocido" / "Sin email" en la UI.
 */
export interface SearchRequest {
  _id: string;
  searchName: string;
  description?: string;
  category?: string;
  status: 'activa' | 'resuelta' | 'cerrada';
  user?: {
    name?: string;
    email?: string;
  };
  createdAt?: string;
}

export interface Disaster {
  _id: string;
  title: string;
  description: string;
  source: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    coordinates: [number, number];
  };
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
