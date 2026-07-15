/**
 * validators/matches.validator — Esquemas Zod para coincidencias
 *
 * PROPÓSITO:
 *   Define el esquema de validación para el parámetro de ruta reportId
 *   en las operaciones de coincidencias.
 *
 * SCHEMAS:
 *   - reportIdParamSchema: reportId como string seguro
 *
 * @module matches.validator
 */

import { z } from 'zod';
import { safeIdString } from '../utils/sanitize.util';

export const reportIdParamSchema = z.object({
  reportId: safeIdString.pipe(z.string().min(1, 'reportId es requerido'))
});
