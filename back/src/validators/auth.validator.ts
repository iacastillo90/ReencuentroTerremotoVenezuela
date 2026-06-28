import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';

export const googleAuthSchema = z.object({
  token: sanitizedString.pipe(z.string().min(10).max(5000)),
});

export const profileUpdateSchema = z.object({
  sector: sanitizedString.pipe(z.string().min(2).max(255)),
  contactNumber: sanitizedString.pipe(z.string().min(7).max(20)),
});

export type GoogleAuthPayload = z.infer<typeof googleAuthSchema>;
export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;
