import { Router, Request, Response } from 'express';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { webhookWhatsAppSchema, webhookTelegramSchema } from '../validators/webhooks.validator';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();

// Endpoint para recibir mensajes de WhatsApp desde n8n
router.post('/n8n/whatsapp', async (req: Request, res: Response) => {
  try {
    const validation = webhookWhatsAppSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'POST /webhooks/n8n/whatsapp validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { messageId, text, sender, timestamp } = validation.data;

    const payload = {
      source: 'whatsapp-n8n',
      externalId: messageId || `wa-${Date.now()}`,
      text: text,
      metadata: {
        sender: sender,
        timestamp: timestamp || new Date().toISOString()
      }
    };

    // Agregar directamente a la cola de procesamiento IA
    await addJobToIAQueue(payload);

    auditLog({
      eventType: 'ingestion_webhook',
      severity: 'info',
      actor: 'system',
      action: 'POST /webhooks/n8n/whatsapp',
      resource: payload.externalId,
      detail: { source: 'whatsapp-n8n' },
      req,
    });

    return res.status(202).json({ status: 'queued', message: 'WhatsApp message accepted for AI extraction' });
  } catch (error) {
    console.error('[Webhooks] WhatsApp Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para recibir mensajes de Telegram desde n8n
router.post('/n8n/telegram', async (req: Request, res: Response) => {
  try {
    const validation = webhookTelegramSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'POST /webhooks/n8n/telegram validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { messageId, text, sender, timestamp } = validation.data;

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

    auditLog({
      eventType: 'ingestion_webhook',
      severity: 'info',
      actor: 'system',
      action: 'POST /webhooks/n8n/telegram',
      resource: payload.externalId,
      detail: { source: 'telegram-n8n' },
      req,
    });

    return res.status(202).json({ status: 'queued', message: 'Telegram message accepted for AI extraction' });
  } catch (error) {
    console.error('[Webhooks] Telegram Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const webhooksRouter = router;
