/**
 * services/mockSearchData.ts — Datos simulados y constantes de búsqueda
 *
 * PROPÓSITO:
 *   Contiene MOCK_RESULTS (datos de ejemplo para el formulario de búsqueda
 *   en SearchPage) y ESTADOS_VE (lista de estados de Venezuela).
 *   Separado de SearchPage.tsx para:
 *   - Reducir el tamaño del componente (antes ~300 líneas, ahora ~100).
 *   - Permitir Fast Refresh sin recargar la página (Vite no puede
 *     hacer HMR cuando un archivo exporta componentes + constantes).
 *   - Facilitar el reemplazo por datos reales de la API en producción.
 */
import type { Person } from '../types';

export type AgeCat = 'adulto' | 'adulto_mayor' | 'mascota' | 'nino';

export interface SearchFilters {
  name: string;
  edad: string;
  fechaDesde: string;
  fechaHasta: string;
  vestimenta: string;
  estado?: string;
  municipio?: string;
  raza?: string;
  fecha?: string;
}

export const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
] as const;

export const MOCK_RESULTS: Record<AgeCat, Person[]> = {
  adulto: [
    { idHash: 'm-1', type: 'person', name: 'Juan Pérez', status: 'missing', age: 35, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Chacao', description: 'Punto de Control PC, Chacao' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'm-2', type: 'person', name: 'María Gonzalez', status: 'missing', age: 42, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Centro de Acopio Macuto' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'm-3', type: 'person', name: 'Carlos Mendoza', status: 'found', age: 28, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Catia', description: 'Hospital Pérez Carreño, Caracas' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Hospital Pérez Carreño' } },
    { idHash: 'm-4', type: 'person', name: 'Ana Silva', status: 'missing', age: 50, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Maiquetía', description: 'Refugio Temporal de Maiquetía' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
  ] as Person[],
  adulto_mayor: [
    { idHash: 'am-1', type: 'person', name: 'Pedro Suárez', status: 'missing', age: 72, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Los Palos Grandes', description: 'Albergue Los Palos Grandes' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'am-2', type: 'person', name: 'Carmen Rojas', status: 'found', age: 68, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Caraballeda', description: 'Sede Cruz Roja, Caraballeda' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'am-3', type: 'person', name: 'José Martínez', status: 'missing', age: 80, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Petare', description: 'Refugio Petare, Caracas' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'am-4', type: 'person', name: 'Teresa Blanco', status: 'missing', age: 75, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Catia La Mar', description: 'Comando Bomberos Catia La Mar' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Bomberos del Distrito Capital' } },
  ] as Person[],
  mascota: [
    { idHash: 'p-1', type: 'animal', name: 'Luna', status: 'missing', description: 'Poodle blanco, collar rojo', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Altamira', description: 'Plaza Altamira - Punto de Rescate' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
    { idHash: 'p-2', type: 'animal', name: 'Max', status: 'found', description: 'Golden Retriever', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Centro Veterinario Macuto' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
    { idHash: 'p-3', type: 'animal', name: 'Milo', status: 'missing', description: 'Gato siamés', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'El Hatillo', description: 'Refugio de Mascotas, El Hatillo' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'p-4', type: 'animal', name: 'Bella', status: 'missing', description: 'Mestiza pequeña, mancha en el ojo', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Caraballeda', description: 'Punto de Control Animal, Caraballeda' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
  ] as Person[],
  nino: [
    { idHash: 'n-1', type: 'person', name: 'Caso Protegido', status: 'missing', age: 10, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Libertador', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'n-2', type: 'person', name: 'Caso Protegido', status: 'found', age: 6, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'n-3', type: 'person', name: 'Caso Protegido', status: 'missing', age: 15, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Chacao', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'n-4', type: 'person', name: 'Caso Protegido', status: 'missing', age: 12, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Maiquetía', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Bomberos del Distrito Capital' } },
  ] as Person[],
};
