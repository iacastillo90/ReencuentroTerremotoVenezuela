/**
 * validators/person.validator — Esquemas Zod para reportes de personas
 *
 * PROPÓSITO:
 *   Define esquemas de validación para la búsqueda y creación de reportes
 *   de personas, así como el tipo PersonPayload utilizado por los adaptadores.
 *
 * SCHEMAS:
 *   - personSearchQuerySchema: búsqueda con filtros (q, status, state, paginación)
 *   - personPayloadSchema: payload completo de persona (source, name, estado, datos, etc.)
 *
 * @module person.validator
 */

import { z } from 'zod';
import { sanitizedString, sanitizedStringOptional, sanitizedQueryParam } from '../utils/sanitize.util';

export const personSearchQuerySchema = z.object({
  q: sanitizedQueryParam.optional(),
  status: z.enum(['missing', 'found', 'unknown', 'deceased', 'animal', 'all']).optional(),
  category: z.enum(['mascota', 'nino', 'adulto', 'adulto_mayor']).optional(),
  state: z.string().max(100).optional(),
  municipality: z.string().max(100).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  vestimenta: sanitizedQueryParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const personPayloadSchema = z.object({
  source: sanitizedString,
  externalId: sanitizedString,
  type: z.enum(['person', 'animal']).default('person'),
  name: sanitizedString.pipe(z.string().min(2)),
  estado: sanitizedString.pipe(z.string().min(2)),
  text: sanitizedStringOptional,
  photoUrl: z.string().optional(),
  date: z.string().datetime().optional(), // ISO string
  confidence_score: z.number().optional(),
  confidence_label: sanitizedStringOptional,
  reportedBy: sanitizedStringOptional,
  isAnonymous: z.boolean().optional(),
  isMinor: z.boolean().optional(),
  reporterIp: z.string().optional(),
  reporterLocation: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  data: z.object({
    age: z.union([z.string(), z.number()]).optional(),
    cedula_hash: z.string().optional()
  }).optional()
});

export type PersonPayload = z.infer<typeof personPayloadSchema>;
