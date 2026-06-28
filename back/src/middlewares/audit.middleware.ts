import { Request, Response, NextFunction } from 'express';
import { AuditLogModel, IAuditLog } from '../models/audit-log.model';

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
      const actor = (req as any).user?.userId || req.ip || 'unknown';

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
        console.error('[AuditLog] Failed to create audit entry:', err.message);
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
    console.error('[AuditLog] Failed to create audit entry:', err.message);
  }
}
