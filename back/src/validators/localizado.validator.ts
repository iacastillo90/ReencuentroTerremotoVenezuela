/**
 * validators/localizado.validator — Esquemas Zod para reportes de localizados
 *
 * PROPÓSITO:
 *   Define esquemas de validación para el reporte masivo de personas
 *   localizadas en refugios y hospitales por parte de socios (partners).
 *
 * SCHEMAS:
 *   - localizadoSubmissionSchema: nombre, cédula, edad, género, origen, ubicación
 *   - localizadoPayloadSchema: array de submissions (hasta 5000 registros)
 *
 * @module localizado.validator
 */

import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';

export const localizadoSubmissionSchema = z.object({
  name: sanitizedString.pipe(z.string().min(2).max(255)),
  cedula: sanitizedString.pipe(z.string().max(20)).optional(),
  age: sanitizedString.pipe(z.string().max(10)).optional(),
  gender: sanitizedString.pipe(z.string().max(20)).optional(),
  origin: sanitizedString.pipe(z.string().max(255)).optional(),
  location: sanitizedString.pipe(z.string().min(2).max(255)),
  isVerified: z.boolean().optional(),
  sourceUrl: z.string().url().optional(),
});

export const localizadoPayloadSchema = z.object({
  data: z.array(localizadoSubmissionSchema).min(1).max(5000),
});

export type LocalizadoSubmission = z.infer<typeof localizadoSubmissionSchema>;
