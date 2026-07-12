import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { createSearchRequestHandler, getMySearchRequestsHandler, updateSearchRequestStatusHandler } from '../controllers/search-request.controller';

const router = Router();

router.post('/', requireUser, createSearchRequestHandler);
router.get('/mine', requireUser, getMySearchRequestsHandler);
router.patch('/:id/status', requireUser, updateSearchRequestStatusHandler);

export const searchRequestRouter = router;
