/**
 * routes/search-request.route.ts — Rutas de solicitudes de búsqueda
 *
 * PROPÓSITO:
 *   Rutas CRUD para solicitudes de búsqueda de usuarios.
 *   Todos los endpoints requieren autenticación y rate limiting.
 *
 * ENDPOINTS:
 *   POST  /api/search-requests — Crear solicitud
 *   GET   /api/search-requests/mine — Mis solicitudes
 *   PATCH /api/search-requests/:id/status — Cambiar estado
 *
 * RATE LIMITING:
 *   - POST: 5 req/min (previene creación masiva)
 *   - GET/PATCH: 20 req/min
 *
 * @module search-request.route
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { searchRequestStatusQuerySchema } from '../validators/search-request.validator';
import { createSearchRequestHandler, getMySearchRequestsHandler, updateSearchRequestStatusHandler } from '../controllers/search-request.controller';

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de búsqueda. Intente nuevamente en 1 minuto.' }
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.' }
});

const router = Router();

router.post('/', createLimiter, requireUser, createSearchRequestHandler);
router.get('/mine', readLimiter, requireUser, validateQuery(searchRequestStatusQuerySchema), getMySearchRequestsHandler);
router.patch('/:id/status', readLimiter, requireUser, updateSearchRequestStatusHandler);

export const searchRequestRouter = router;
