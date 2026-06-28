import { z } from 'zod';

export const personPayloadSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1),
  type: z.enum(['person', 'animal']).default('person'),
  name: z.string().min(2),
  estado: z.string().min(2),
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  date: z.string().datetime().optional(), // ISO string
  confidence_score: z.number().optional(),
  confidence_label: z.string().optional(),
  reportedBy: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  data: z.object({
    age: z.union([z.string(), z.number()]).optional(),
    cedula_hash: z.string().optional()
  }).optional()
});

export type PersonPayload = z.infer<typeof personPayloadSchema>;
