import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { sendContactMessage, getSentMessagesHandler, getReceivedMessagesHandler } from '../controllers/contact.controller';

const router = Router();

router.post('/', requireUser, sendContactMessage);
router.get('/sent', requireUser, getSentMessagesHandler);
router.get('/received', requireUser, getReceivedMessagesHandler);

export const contactRouter = router;
