/**
 * routes/cne.route.ts — Rutas de consulta al CNE
 *
 * PROPÓSITO:
 *   Ruta para consultar datos de identidad venezolana (CNE).
 *   Tiene rate limiting estricto (5 req/min) ya que consulta
 *   un servicio externo frágil.
 *
 * SEGURIDAD:
 *   - Rate limit: 5 req / min (suficiente para uso legítimo)
 *   - validateParams: Zod valida nationality (V/E) + cédula (numérica, max 10 dígitos)
 *   - Sin autenticación (uso público), pero rate limited
 *
 * @module cne.route
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validateParams } from '../middlewares/validate.middleware';
import { getCneIdentity } from '../controllers/cne.controller';

const cneParamsSchema = z.object({
  nationality: z.enum(['V', 'E']),
  cedula: z.string().regex(/^\d{1,10}$/, 'Cédula debe ser numérica (máx 10 dígitos)'),
});

const cneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas al CNE. Intente nuevamente en 1 minuto.' },
});

export const cneRouter = Router();

cneRouter.get('/:nationality/:cedula', cneLimiter, validateParams(cneParamsSchema), getCneIdentity);
