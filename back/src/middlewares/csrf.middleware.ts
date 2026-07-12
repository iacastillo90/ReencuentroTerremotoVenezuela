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
  '/api/localizados',
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

  // Skip for API-key-authenticated requests (no cookie session)
  if (req.headers['x-api-key']) {
    next();
    return;
  }

  const isExempt = CSRF_EXEMPT_PATHS.some((path) => {
    return req.path === path || req.path.startsWith(path + '/');
  });
  if (isExempt) {
    next();
    return;
  }

  const cookieToken: string | undefined = req.cookies?.['csrf-token'];
  const headerToken: string | undefined = req.headers['x-csrf-token'] as string;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  if (cookieToken.length !== headerToken.length) {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken),
    );
    if (!match) {
      res.status(403).json({ error: 'Token CSRF inválido' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'Token CSRF inválido' });
    return;
  }

  next();
}
