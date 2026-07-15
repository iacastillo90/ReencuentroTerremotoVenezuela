/**
 * controllers/webhooks.controller.ts — Webhooks de mensajería externa
 *
 * PROPÓSITO:
 *   Recibe mensajes de plataformas externas (WhatsApp, Telegram) vía
 *   webhooks n8n, los valida y los encola para procesamiento por IA.
 *   Es el punto de entrada para la ingesta de datos desde canales
 *   de mensajería.
 *
 * CARACTERÍSTICAS:
 *   - receiveWhatsApp: Webhook para mensajes de WhatsApp (n8n)
 *   - receiveTelegram: Webhook para mensajes de Telegram (n8n)
 *   - Ambos validan con Zod y encolan a IA queue
 *   - Audit log en validación y envío
 *   - Respuesta 202: Aceptado para procesamiento async
 *
 * FLUJO DE DATOS:
 *   1. n8n envía POST al webhook con messageId, text, sender, timestamp
 *   2. Zod valida (webhookWhatsAppSchema / webhookTelegramSchema)
 *   3. Si inválido: 400 + audit log con issues de validación
 *   4. Si válido: addJobToIAQueue(payload) → BullMQ queue
 *   5. Audit log con resource = externalId
 *   6. Respuesta 202: mensaje encolado para extracción por IA
 *
 * SEGURIDAD:
 *   - x-webhook-api-key: Solo n8n autenticado (CSRF exento)
 *   - Zod validation: Texto máx 5000 chars, sender máx 200 chars
 *   - Audit log en fallos y éxitos: Trazabilidad completa
 *   - No ejecuta IA directamente: Encola para procesamiento async
 *   - source fijo: 'whatsapp-n8n' o 'telegram-n8n' (no confía en input)
 *
 * ENDPOINTS:
 *   POST /api/webhooks/n8n/whatsapp — Webhook WhatsApp
 *   POST /api/webhooks/n8n/telegram — Webhook Telegram
 *
 * @module webhooks.controller
 */
import { Request, Response, NextFunction } from 'express';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { webhookWhatsAppSchema, webhookTelegramSchema } from '../validators/webhooks.validator';
import { auditLog } from '../middlewares/audit.middleware';

export async function receiveWhatsApp(req: Request, res: Response, next: NextFunction) {
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
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
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
    next(error);
  }
}

export async function receiveTelegram(req: Request, res: Response, next: NextFunction) {
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
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
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
    next(error);
  }
}
