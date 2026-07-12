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
