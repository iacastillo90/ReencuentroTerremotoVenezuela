/**
 * routes/partner.route.ts — Rutas de partners (integración)
 *
 * PROPÓSITO:
 *   Rutas para integración con organizaciones aliadas. Ambos endpoints
 *   requieren partner API key y tienen rate limit de 60 req/min.
 *
 * ENDPOINTS:
 *   GET  /api/partner/cases — Consultar casos (paginado)
 *   POST /api/partner/cases — Ingresar casos
 *
 * @module partner.route
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { getPartnerCasesHandler, postPartnerCasesHandler } from '../controllers/partner.controller';

const partnerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes al endpoint de partner. Intente nuevamente en 1 minuto.' },
});

export const partnerRouter = Router();

partnerRouter.get('/cases', partnerLimiter, requirePartnerApiKey, getPartnerCasesHandler);
partnerRouter.post('/cases', partnerLimiter, requirePartnerApiKey, postPartnerCasesHandler);
