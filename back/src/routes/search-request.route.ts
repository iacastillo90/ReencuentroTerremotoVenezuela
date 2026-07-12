import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { createSearchRequest, getMySearchRequests, updateSearchRequestStatus } from '../controllers/search-request.controller';

const router = Router();

router.post('/', requireUser, createSearchRequest);
router.get('/mine', requireUser, getMySearchRequests);
router.patch('/:id/status', requireUser, updateSearchRequestStatus);

export const searchRequestRouter = router;
