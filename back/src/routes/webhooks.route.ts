import { Router } from 'express';
import { requireWebhookApiKey } from '../middlewares/auth.middleware';
import { receiveWhatsApp, receiveTelegram } from '../controllers/webhooks.controller';

const router = Router();

router.use('/n8n', requireWebhookApiKey);

router.post('/n8n/whatsapp', receiveWhatsApp);
router.post('/n8n/telegram', receiveTelegram);

export const webhooksRouter = router;
