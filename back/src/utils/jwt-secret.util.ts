import crypto from 'crypto';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret) return envSecret;

  const devFallback = process.env.JWT_SECRET_DEV_FALLBACK || crypto.randomBytes(64).toString('hex');
  console.warn('[JWT] No JWT_SECRET env var set. Using development fallback. Set JWT_SECRET for production.');
  return devFallback;
}

export const JWT_SECRET = resolveJwtSecret();
