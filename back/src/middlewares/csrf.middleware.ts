import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Generate a CSRF token for the double-submit cookie pattern.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Paths exempt from CSRF protection (webhooks, partners, auth).
 */
export const CSRF_EXEMPT_PATHS = [
  '/api/webhooks',
  '/api/partners',
  '/api/auth/google',
  '/api/admin',         // protected by requireAdminApiKey (JWT + API key)
  '/api/localizados',   // ingestion endpoint protected by requirePartnerApiKey
];

/**
 * CSRF protection middleware — double-submit cookie pattern.
 * Expects csrf-token cookie + x-csrf-token header to match.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Skip exempt paths
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => req.path.startsWith(path));
  if (isExempt) {
    next();
    return;
  }

  const cookieToken: string | undefined = req.cookies?.['csrf-token'];
  const headerToken: string | undefined = req.headers['x-csrf-token'] as string;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  // timingSafeEqual requires equal-length buffers
  if (cookieToken.length !== headerToken.length) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken),
    );
    if (!match) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}
