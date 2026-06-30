import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';

export const adminStatusUpdateSchema = z.object({
  status: z.enum(['missing', 'found', 'deceased', 'unknown']),
});

export const adminMergeSchema = z.object({
  targetIdHash: sanitizedString.pipe(z.string().min(1).max(128)),
});

export type AdminStatusUpdate = z.infer<typeof adminStatusUpdateSchema>;
export type AdminMergePayload = z.infer<typeof adminMergeSchema>;
