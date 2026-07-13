/**
 * middlewares/audit.middleware.ts — Auditoría de acciones
 *
 * PROPÓSITO:
 *   Provee dos mecanismos de auditoría: un middleware Express que
 *   captura automáticamente cada request (con status code y duración),
 *   y una función independiente (auditLog) para logging manual desde
 *   handlers. Ambos son fire-and-forget (nunca bloquean la respuesta).
 *
 * CARACTERÍSTICAS:
 *   - createAuditMiddleware: Factory que crea middleware por eventType
 *   - auditLog: Función standalone para logging manual
 *   - Captura método HTTP, path, IP, user-agent, status code, duración
 *   - Fire-and-forget: catch silencioso si la BD falla
 *   - getResource callback opcional: Extrae recurso del req
 *
 * FLUJO (middleware):
 *   1. Intercepta res.end antes de la respuesta
 *   2. Después de res.end (response enviada), crea AuditLog entry
 *   3. No bloquea la respuesta (next() se llama inmediatamente)
 *
 * @module audit.middleware
 */
import { Request, Response, NextFunction } from 'express';
import { AuditLogModel, IAuditLog } from '../models/audit-log.model';
import { logger } from '../utils/logger.util';

export function createAuditMiddleware(
  eventType: IAuditLog['eventType'],
  severity: IAuditLog['severity'],
  getResource?: (req: Request) => string | undefined,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture the original end to log after response
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      const duration = Date.now() - startTime;
      const actor = req.user?.userId || req.ip || 'unknown';

      const entry: Partial<IAuditLog> = {
        eventType,
        severity,
        actor,
        action: `${req.method} ${req.path}`,
        resource: getResource ? getResource(req) : undefined,
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || undefined,
        timestamp: new Date(),
        detail: { statusCode: res.statusCode, durationMs: duration },
      };

      // Fire-and-forget — never block the response
      AuditLogModel.create(entry).catch((err: Error) => {
        logger.error({ err: err.message }, '[AuditLog] Failed to create audit entry');
      });

      return originalEnd.apply(this, args as any);
    };

    next();
  };
}

/**
 * Standalone function for manual audit logging from route handlers.
 */
export async function auditLog(params: {
  eventType: IAuditLog['eventType'];
  severity: IAuditLog['severity'];
  actor: string;
  action: string;
  resource?: string;
  detail?: Record<string, any>;
  req?: Request;
}): Promise<void> {
  try {
    await AuditLogModel.create({
      eventType: params.eventType,
      severity: params.severity,
      actor: params.actor,
      action: params.action,
      resource: params.resource,
      detail: params.detail,
      ip: params.req?.ip || 'unknown',
      userAgent: params.req?.headers['user-agent'] || undefined,
      timestamp: new Date(),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[AuditLog] Failed to create audit entry');
  }
}
