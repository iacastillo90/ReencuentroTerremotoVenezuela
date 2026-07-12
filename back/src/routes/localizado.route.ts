import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { getLocalizadosHandler, postLocalizadosHandler } from '../controllers/localizado.controller';
import { validateQuery } from '../middlewares/validate.middleware';
import { sanitizedQueryParam } from '../utils/sanitize.util';

const getLocalizadosQuerySchema = z.object({
  q: sanitizedQueryParam.optional(),
  location: sanitizedQueryParam.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const localizadoGetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.' },
});

const localizadoPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de ingreso. Intente nuevamente en 1 minuto.' },
});

export const localizadoRouter = Router();

localizadoRouter.get('/', localizadoGetLimiter, validateQuery(getLocalizadosQuerySchema), getLocalizadosHandler);
localizadoRouter.post('/', localizadoPostLimiter, requirePartnerApiKey, postLocalizadosHandler);
