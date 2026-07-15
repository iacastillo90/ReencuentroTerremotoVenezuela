/**
 * routes/disasters.route.ts — Rutas de desastres
 *
 * PROPÓSITO:
 *   Rutas públicas para consultar eventos de desastre activos.
 *   Sin autenticación requerida (uso público), con rate limiting.
 *
 * ENDPOINTS:
 *   GET /api/disasters — Lista todos los desastres
 *   GET /api/disasters/active — Desastres activos actualmente
 *
 * RATE LIMITING:
 *   - 20 req/min para ambos endpoints (uso público intensivo)
 *
 * @module disasters.route
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDisasters, getActiveDisastersHandler } from '../controllers/disasters.controller';

const disastersLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.' }
});

const router = Router();

router.get('/', disastersLimiter, getDisasters);
router.get('/active', disastersLimiter, getActiveDisastersHandler);

export const disastersRouter = router;
