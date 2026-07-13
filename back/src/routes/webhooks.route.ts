/**
 * routes/webhooks.route.ts — Rutas de webhooks (n8n)
 *
 * PROPÓSITO:
 *   Rutas para recibir webhooks de n8n (WhatsApp y Telegram). El
 *   middleware requireWebhookApiKey protege TODA la ruta /n8n, y el
 *   rate limit es de 30 req/min para evitar sobrecarga.
 *
 * SEGURIDAD:
 *   - requireWebhookApiKey en toda la subruta /n8n
 *   - Rate limit 30/min global en /n8n
 *   - CSRF exento (autenticado via API key)
 *
 * ENDPOINTS:
 *   POST /api/webhooks/n8n/whatsapp — Webhook WhatsApp
 *   POST /api/webhooks/n8n/telegram — Webhook Telegram
 *
 * @module webhooks.route
 */
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
