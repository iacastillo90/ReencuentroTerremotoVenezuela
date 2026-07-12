import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireProfileComplete, requireUser } from '../middlewares/auth.middleware';
import { getCounts, getMyReports, getPersons, createPerson, closeCase } from '../controllers/person.controller';

const router = Router();

router.get('/counts', getCounts);
router.get('/mine', requireUser, getMyReports);
router.get('/', getPersons);

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
