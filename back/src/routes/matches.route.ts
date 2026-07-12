import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { validateParams } from '../middlewares/validate.middleware';
import { reportIdParamSchema } from '../validators/matches.validator';
import { getMatchesByReport } from '../controllers/matches.controller';

const router = Router();

router.get('/:reportId', requireUser, validateParams(reportIdParamSchema), getMatchesByReport);

export const matchesRouter = router;
