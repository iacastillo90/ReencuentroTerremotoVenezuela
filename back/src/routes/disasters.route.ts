/**
 * routes/disasters.route.ts — Rutas de desastres
 *
 * PROPÓSITO:
 *   Rutas públicas para consultar eventos de desastre activos.
 *   Sin autenticación requerida (uso público).
 *
 * ENDPOINTS:
 *   GET /api/disasters — Lista todos los desastres
 *   GET /api/disasters/active — Desastres activos actualmente
 *
 * @module disasters.route
 */
import { Router } from 'express';
import { getDisasters, getActiveDisastersHandler } from '../controllers/disasters.controller';

const router = Router();

router.get('/', getDisasters);
router.get('/active', getActiveDisastersHandler);

export const disastersRouter = router;
