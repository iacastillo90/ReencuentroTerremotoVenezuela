import { Router, Request, Response, NextFunction } from 'express';
import { addJobToIAQueue } from '../queues/ia-process.queue';

const router = Router();

// Verifica un secreto compartido (cabecera x-webhook-secret) antes de aceptar el webhook.
// Falla cerrado en producción si no está configurado; en desarrollo avisa y deja pasar.
function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Webhooks] N8N_WEBHOOK_SECRET no definido en producción. Se rechaza el webhook.');
      return res.status(503).json({ error: 'Webhook no configurado' });
    }
    console.warn('[Webhooks] N8N_WEBHOOK_SECRET no definido: aceptando sin verificar (solo desarrollo).');
    return next();
  }
  const provided = req.headers['x-webhook-secret'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }
  next();
}

// Endpoint para recibir mensajes de WhatsApp desde n8n
router.post('/n8n/whatsapp', requireWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { messageId, text, sender, timestamp } = req.body;

    if (!text || !sender) {
      return res.status(400).json({ error: 'Missing required fields: text or sender' });
    }

    const payload = {
      source: 'whatsapp-n8n',
      externalId: messageId || `wa-${Date.now()}`,
      text: text,
      metadata: {
        sender: sender, // n8n could anonymize this if required
        timestamp: timestamp || new Date().toISOString()
      }
    };

    // Agregar directamente a la cola de procesamiento IA
    await addJobToIAQueue(payload);

    return res.status(202).json({ status: 'queued', message: 'WhatsApp message accepted for AI extraction' });
  } catch (error) {
    console.error('[Webhooks] WhatsApp Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para recibir mensajes de Telegram desde n8n
router.post('/n8n/telegram', requireWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { messageId, text, sender, timestamp } = req.body;

    if (!text || !sender) {
      return res.status(400).json({ error: 'Missing required fields: text or sender' });
    }

    const payload = {
      source: 'telegram-n8n',
      externalId: messageId || `tg-${Date.now()}`,
      text: text,
      metadata: {
        sender: sender,
        timestamp: timestamp || new Date().toISOString()
      }
    };

    // Agregar directamente a la cola de procesamiento IA
    await addJobToIAQueue(payload);

    return res.status(202).json({ status: 'queued', message: 'Telegram message accepted for AI extraction' });
  } catch (error) {
    console.error('[Webhooks] Telegram Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const webhooksRouter = router;
