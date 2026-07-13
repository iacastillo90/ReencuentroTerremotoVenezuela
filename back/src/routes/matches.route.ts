/**
 * routes/matches.route.ts — Rutas de matches/coincidencias
 *
 * PROPÓSITO:
 *   Ruta para consultar matches de un reporte específico.
 *   Requiere autenticación y validación de params.
 *
 * ENDPOINT:
 *   GET /api/matches/:reportId — Matches de un reporte
 *
 * @module matches.route
 */
import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { validateParams } from '../middlewares/validate.middleware';
import { reportIdParamSchema } from '../validators/matches.validator';
import { getMatchesByReport } from '../controllers/matches.controller';

const router = Router();

router.get('/:reportId', requireUser, validateParams(reportIdParamSchema), getMatchesByReport);

export const matchesRouter = router;
