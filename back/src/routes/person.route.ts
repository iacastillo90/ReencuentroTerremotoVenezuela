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
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const router = Router();

router.get('/counts', getCounts);
router.get('/mine', requireUser, getMyReports);
router.get('/', validateQuery(getPersonsQuerySchema), getPersons);

const createPersonLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Por favor, intente más tarde.' }
});

router.post('/', createPersonLimiter, requireProfileComplete, createPerson);
router.post('/:idHash/close', requireUser, closeCase);

export const personRouter = router;
