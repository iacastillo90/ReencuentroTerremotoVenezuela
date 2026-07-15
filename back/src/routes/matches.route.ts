/**
 * routes/matches.route.ts — Rutas de matches/coincidencias
 *
 * PROPÓSITO:
 *   Ruta para consultar matches de un reporte específico.
 *   Requiere autenticación, validación de params y rate limiting.
 *
 * ENDPOINT:
 *   GET /api/matches/:reportId — Matches de un reporte
 *
 * RATE LIMITING:
 *   - 20 req/min por IP (previene scraping de matches)
 *
 * @module matches.route
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import { validateParams } from '../middlewares/validate.middleware';
import { reportIdParamSchema } from '../validators/matches.validator';
import { getMatchesByReport } from '../controllers/matches.controller';

const matchesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.' }
});

const router = Router();

router.get('/:reportId', matchesLimiter, requireUser, validateParams(reportIdParamSchema), getMatchesByReport);

export const matchesRouter = router;
