import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { getMatchesByReport } from '../controllers/matches.controller';

const router = Router();

router.get('/:reportId', requireUser, getMatchesByReport);

export const matchesRouter = router;
