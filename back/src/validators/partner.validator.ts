import { z } from 'zod';
import { sanitizedString, sanitizedStringOptional, sanitize } from '../utils/sanitize.util';

const geoJsonSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
}).optional();

export const partnerCaseSchema = z.object({
  name: sanitizedString.pipe(z.string().min(2).max(255)),
  status: z.enum(['missing', 'found', 'deceased', 'unknown']).default('missing'),
  lastSeen: z.object({
    state: sanitizedString.pipe(z.string().min(2).max(255)),
    municipality: sanitizedStringOptional,
    description: sanitizedStringOptional,
    coordinates: geoJsonSchema,
    date: z.string().optional(),
  }).optional(),
  age: z.number().min(0).max(150).optional(),
  gender: z.enum(['M', 'F', 'other', 'unknown']).optional(),
  description: z.string().trim().transform(v => sanitize(v)).pipe(z.string().max(5000)).optional(),
  photoUrl: z.string().url().optional(),
  aliases: z.array(sanitizedStringOptional).max(20).optional(),
  contactPerson: z.object({
    name: sanitizedString.pipe(z.string().min(2).max(255)),
    phone: sanitizedStringOptional,
    relationship: sanitizedString.pipe(z.string().min(2).max(255)),
  }).optional(),
});

export const partnerCasesPayloadSchema = z.object({
  cases: z.array(partnerCaseSchema).min(1).max(1000),
});

export type PartnerCasePayload = z.infer<typeof partnerCaseSchema>;
