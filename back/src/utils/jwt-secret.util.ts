import crypto from 'crypto';
import { logger } from './logger.util';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production. Set JWT_SECRET environment variable.');
  }

  const devFallback = process.env.JWT_SECRET_DEV_FALLBACK || crypto.randomBytes(64).toString('hex');
  logger.warn('[JWT] No JWT_SECRET env var set. Using development fallback. Set JWT_SECRET for production.');
  return devFallback;
}

export const JWT_SECRET = resolveJwtSecret();
