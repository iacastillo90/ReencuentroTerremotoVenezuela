/**
 * adapters/base.adapter — Interfaz base para adaptadores de fuentes externas
 *
 * PROPÓSITO:
 *   Define el contrato que todo adaptador de fuente de datos debe implementar
 *   para normalizar datos de personas desde formatos externos al schema interno.
 *
 * CARACTERÍSTICAS:
 *   - Genérico T permite tipar el formato raw de cada fuente
 *   - sourceName identifica la fuente de origen
 *   - normalize() transforma datos raw al formato PersonPayload
 *
 * @module base.adapter
 */

import { PersonPayload } from '../validators/person.validator';

export interface ISourceAdapter<T = any> {
  sourceName: string;
  normalize(rawData: T): PersonPayload;
}
