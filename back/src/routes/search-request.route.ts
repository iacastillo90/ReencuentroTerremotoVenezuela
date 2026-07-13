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
