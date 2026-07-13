/**
 * middlewares/csrf.middleware.ts — Protección CSRF (Double-Submit Cookie)
 *
 * PROPÓSITO:
 *   Implementa el patrón Double-Submit Cookie para prevenir ataques CSRF.
 *   Compara un token en cookie (csrf-token) con el mismo token en header
 *   (x-csrf-token). Usa timingSafeEqual para prevenir timing attacks.
 *
 * CARACTERÍSTICAS:
 *   - generateCsrfToken: Genera token de 32 bytes hex (64 chars)
 *   - csrfProtection: Middleware que valida match cookie ↔ header
 *   - Exención para métodos seguros (GET, HEAD, OPTIONS)
 *   - Exención para rutas con API key (x-api-key header)
 *   - Exención para rutas específicas (webhooks, partners, auth, localizados)
 *
 * FLUJO DE VALIDACIÓN:
 *   1. ¿Es GET/HEAD/OPTIONS? → Skip
 *   2. ¿Tiene x-api-key? → Skip (API key auth, no cookie session)
 *   3. ¿Es ruta exenta? → Skip (webhooks, partners, etc.)
 *   4. ¿Existen cookie csrf-token Y header x-csrf-token? → No → 403
 *   5. ¿Misma longitud? → No → 403
 *   6. timingSafeEqual(cookie, header) → No match → 403
 *   7. OK → next()
 *
 * RUTAS EXENTAS:
 *   /api/webhooks — Webhooks de n8n (no tienen sesión de navegador)
 *   /api/partners — API de partners (usan API key)
 *   /api/auth/google — Google OAuth redirect (callback externo)
 *   /api/localizados — Endpoints de refugios/hospitales (API key)
 *
 * SEGURIDAD:
 *   - timingSafeEqual: Previene timing attacks en comparación de tokens
 *   - Token de 32 bytes: 256 bits de entropía (imposible de forzar)
 *   - catch en timingSafeEqual: Previene crash si buffers son incompatibles
 *   - Exención selectiva: Solo lo necesario, no blind exemption
 *
 * DECISIONES TÉCNICAS:
 *   - Double-Submit Cookie sobre SameSite: Más flexible para múltiples clientes
 *   - timingSafeEqual sobre comparación directa: Previene timing oracle attacks
 *   - length check previo: Early exit optimizado + seguridad en capas
 *   - x-api-key exemption: API key auth no necesita CSRF (no hay cookie session)
 *
 * CÓMO USAR:
 *   app.use(csrfProtection); // Global para todos los métodos mutantes
 *   // En cliente: leer cookie csrf-token, enviar como x-csrf-token header
 */
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
