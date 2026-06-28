import { z } from 'zod';
import { sanitizedString, sanitizedStringOptional } from '../utils/sanitize.util';

export const webhookWhatsAppSchema = z.object({
  messageId: sanitizedStringOptional,
  text: sanitizedString.pipe(z.string().max(10000)),
  sender: sanitizedString.pipe(z.string().max(255)),
  timestamp: sanitizedStringOptional,
});

export const webhookTelegramSchema = z.object({
  messageId: sanitizedStringOptional,
  text: sanitizedString.pipe(z.string().max(10000)),
  sender: sanitizedString.pipe(z.string().max(255)),
  timestamp: sanitizedStringOptional,
});

export type WebhookPayload = z.infer<typeof webhookWhatsAppSchema>;
