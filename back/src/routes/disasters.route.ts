import { Router } from 'express';
import { getDisasters, getActiveDisastersHandler } from '../controllers/disasters.controller';

const router = Router();

router.get('/', getDisasters);
router.get('/active', getActiveDisastersHandler);

export const disastersRouter = router;
