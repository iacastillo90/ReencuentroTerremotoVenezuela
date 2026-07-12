import { Router } from 'express';
import { getDisasters, getActiveDisasters } from '../controllers/disasters.controller';

const router = Router();

router.get('/', getDisasters);
router.get('/active', getActiveDisasters);

export const disastersRouter = router;
