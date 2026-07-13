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
