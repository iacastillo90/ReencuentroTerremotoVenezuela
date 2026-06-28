import { z } from 'zod';
import { sanitizedString, sanitize } from '../utils/sanitize.util';

export const localizadoSubmissionSchema = z.object({
  name: sanitizedString.pipe(z.string().min(2).max(255)),
  cedula: z.string().trim().transform(v => sanitize(v)).pipe(z.string().max(20)).optional(),
  age: z.string().trim().transform(v => sanitize(v)).pipe(z.string().max(10)).optional(),
  gender: z.string().trim().transform(v => sanitize(v)).pipe(z.string().max(20)).optional(),
  origin: z.string().trim().transform(v => sanitize(v)).pipe(z.string().max(255)).optional(),
  location: sanitizedString.pipe(z.string().min(2).max(255)),
  isVerified: z.boolean().optional(),
  sourceUrl: z.string().url().optional(),
});

export const localizadoPayloadSchema = z.object({
  data: z.array(localizadoSubmissionSchema).min(1).max(5000),
});

export type LocalizadoSubmission = z.infer<typeof localizadoSubmissionSchema>;
