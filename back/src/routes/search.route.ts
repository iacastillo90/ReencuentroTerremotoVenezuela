/**
 * routes/search.route.ts — Rutas de búsqueda vectorial
 *
 * PROPÓSITO:
 *   Ruta para búsqueda semántica con embeddings. Sin autenticación
 *   (uso público) pero con rate limit de 20 req / 15 min para
 *   prevenir abuso del servicio de embeddings (costo por llamada AI).
 *
 * ENDPOINT:
 *   POST /api/search/vector — Búsqueda semántica
 *
 * @module search.route
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { vectorSearch } from '../controllers/search.controller';

const router = Router();

const vectorSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas. Por favor, intente más tarde.' }
});

router.post('/vector', vectorSearchLimiter, vectorSearch);

export const searchRouter = router;
