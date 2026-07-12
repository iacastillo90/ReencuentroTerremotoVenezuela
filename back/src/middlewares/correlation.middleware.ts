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
