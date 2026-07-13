import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireWebhookApiKey } from '../middlewares/auth.middleware';
import { receiveWhatsApp, receiveTelegram } from '../controllers/webhooks.controller';

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes al webhook. Intente nuevamente en 1 minuto.' },
});

const router = Router();

router.use('/n8n', webhookLimiter, requireWebhookApiKey);

router.post('/n8n/whatsapp', receiveWhatsApp);
router.post('/n8n/telegram', receiveTelegram);

export const webhooksRouter = router;
