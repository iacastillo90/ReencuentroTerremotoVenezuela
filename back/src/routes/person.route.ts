/**
 * routes/person.route.ts — Rutas de personas
 *
 * PROPÓSITO:
 *   Define los endpoints públicos/privados para consultar y crear
 *   reportes de personas. Expone endpoints para conteos, búsqueda,
 *   y creación de reportes con rate limiting específico.
 *
 * ENDPOINTS:
 *   GET /api/persons/counts — Estadísticas cacheadas (5min Redis)
 *   GET /api/persons/mine — Mis reportes (auth required)
 *   GET /api/persons — Búsqueda con filtros (Zod validated)
 *   POST /api/persons — Crear reporte (rate limit: 10/min, auth required)
 *   POST /api/persons/:idHash/close — Cerrar caso (auth required)
 *
 * VALIDACIÓN:
 *   - getPersonsQuerySchema: q (sanitized), status, category, state, municipality
 *   - limit: 1-100 (default 50), offset: ≥0
 *   - validateQuery middleware reemplaza req.query con datos tipados
 *
 * RATE LIMITING:
 *   - createPersonLimiter: 10 req/min (previene spam de reportes)
 *   - counts: Sin limit (endpoint de lectura, cacheado)
 *   - mine: Sin limit (auth required, datos del usuario)
 *
 * SEGURIDAD:
 *   - requireUser: JWT válido para endpoints privados
 *   - requireProfileComplete: Bloquea creación si perfil incompleto
 *   - sanitizedQueryParam: Previene NoSQL injection en búsquedas
 *   - toPublicPerson: Excluye PII en responses (embedding, faceEncoding)
 *
 * DECISIONES TÉCNICAS:
 *   - Counts separado: endpoint dedicado para estadísticas (muy usado)
 *   - Búsqueda con validateQuery: Zod transforma y sanitiza query params
 *   - closeCase requiere auth: previene cierre malicioso de reportes
 *
 * EJEMPLOS:
 *   GET /api/persons?status=missing&state=Caracas&limit=20
 *   GET /api/persons/mine?limit=10 (Authorization: Bearer xxx)
 *   POST /api/persons { name, lastSeen, ... } (Authorization: Bearer xxx)
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireProfileComplete, requireUser } from '../middlewares/auth.middleware';
import { getCounts, getMyReports, getPersons, createPerson, closeCase } from '../controllers/person.controller';
import { validateQuery } from '../middlewares/validate.middleware';
import { sanitizedQueryParam } from '../utils/sanitize.util';

const getPersonsQuerySchema = z.object({
  q: sanitizedQueryParam.optional(),
  status: z.enum(['missing', 'found', 'unknown', 'deceased', 'animal', 'all']).optional(),
  category: z.enum(['mascota', 'nino', 'adulto', 'adulto_mayor']).optional(),
  state: z.string().max(100).optional(),
  municipality: z.string().max(100).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  vestimenta: sanitizedQueryParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const getPersonsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente.' }
});

const getCountsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente.' }
});

const closeCaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente.' }
});

const router = Router();

router.get('/counts', getCountsLimiter, getCounts);
router.get('/mine', requireUser, getMyReports);
router.get('/', getPersonsLimiter, validateQuery(getPersonsQuerySchema), getPersons);

const createPersonLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Por favor, intente más tarde.' }
});

router.post('/', createPersonLimiter, requireProfileComplete, createPerson);
router.post('/:idHash/close', closeCaseLimiter, requireUser, closeCase);

export const personRouter = router;
