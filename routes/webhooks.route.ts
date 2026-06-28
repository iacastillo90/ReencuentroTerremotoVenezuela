import { Router, Request, Response } from 'express';
import { addJobToIAQueue } from '../queues/ia-process.queue';

const router = Router();

// Endpoint para recibir mensajes de WhatsApp desde n8n
router.post('/n8n/whatsapp', async (req: Request, res: Response) => {
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
router.post('/n8n/telegram', async (req: Request, res: Response) => {
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
