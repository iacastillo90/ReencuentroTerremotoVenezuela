/**
 * middlewares/correlation.middleware.ts — ID de correlación para tracing
 *
 * PROPÓSITO:
 *   Asigna un correlationId único a cada request entrante, ya sea
 *   tomándolo del header x-request-id/x-correlation-id (si un proxy
 *   lo envió) o generando un UUID. El ID se propaga a los logs
 *   (via Pino child logger) y se devuelve en el header de respuesta.
 *
 * CARACTERÍSTICAS:
 *   - Toma correlationId de headers externos (x-request-id, x-correlation-id)
 *   - Fallback a crypto.randomUUID()
 *   - Crea logger child con correlationId para tracing contextual
 *   - Setea header de respuesta x-request-id
 *
 * USO:
 *   req.log.info('mensaje') → incluye correlationId automáticamente
 *   req.correlationId → disponible en toda la cadena de handlers
 *
 * @module correlation.middleware
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.util';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      log: typeof logger;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] || req.headers['x-correlation-id'] || crypto.randomUUID()) as string;
  req.correlationId = correlationId;
  req.log = logger.child({ correlationId });
  res.setHeader('x-request-id', correlationId);
  next();
}
