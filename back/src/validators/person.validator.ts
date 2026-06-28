import { z } from 'zod';
import { sanitizedString, sanitizedStringOptional } from '../utils/sanitize.util';

export const personPayloadSchema = z.object({
  source: sanitizedString,
  externalId: sanitizedString,
  type: z.enum(['person', 'animal']).default('person'),
  name: sanitizedString.pipe(z.string().min(2)),
  estado: sanitizedString.pipe(z.string().min(2)),
  text: sanitizedStringOptional,
  photoUrl: z.string().url().optional(),
  date: z.string().datetime().optional(), // ISO string
  confidence_score: z.number().optional(),
  confidence_label: sanitizedStringOptional,
  reportedBy: sanitizedStringOptional,
  isAnonymous: z.boolean().optional(),
  data: z.object({
    age: z.union([z.string(), z.number()]).optional(),
    cedula_hash: z.string().optional()
  }).optional()
});

export type PersonPayload = z.infer<typeof personPayloadSchema>;
