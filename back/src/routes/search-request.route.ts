/**
 * routes/search-request.route.ts — Rutas de solicitudes de búsqueda
 *
 * PROPÓSITO:
 *   Rutas CRUD para solicitudes de búsqueda de usuarios.
 *   Todos los endpoints requieren autenticación.
 *
 * ENDPOINTS:
 *   POST  /api/search-requests — Crear solicitud
 *   GET   /api/search-requests/mine — Mis solicitudes
 *   PATCH /api/search-requests/:id/status — Cambiar estado
 *
 * @module search-request.route
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { searchRequestStatusQuerySchema } from '../validators/search-request.validator';
import { createSearchRequestHandler, getMySearchRequestsHandler, updateSearchRequestStatusHandler } from '../controllers/search-request.controller';

const router = Router();

router.post('/', requireUser, createSearchRequestHandler);
router.get('/mine', requireUser, validateQuery(searchRequestStatusQuerySchema), getMySearchRequestsHandler);
router.patch('/:id/status', requireUser, updateSearchRequestStatusHandler);

export const searchRequestRouter = router;
