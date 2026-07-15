/**
 * validators/search-request.validator — Esquemas Zod para solicitudes de búsqueda
 *
 * PROPÓSITO:
 *   Define el esquema de validación para el filtro de estado en la
 *   consulta de solicitudes de búsqueda.
 *
 * SCHEMAS:
 *   - searchRequestStatusQuerySchema: status (pending/approved/rejected/archived)
 *
 * @module search-request.validator
 */

import { z } from 'zod';

export const searchRequestStatusQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'archived']).optional(),
});