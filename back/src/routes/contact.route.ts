import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { sendContactMessage, getSentMessages, getReceivedMessages } from '../controllers/contact.controller';

const router = Router();

router.post('/', requireUser, sendContactMessage);
router.get('/sent', requireUser, getSentMessages);
router.get('/received', requireUser, getReceivedMessages);

export const contactRouter = router;
