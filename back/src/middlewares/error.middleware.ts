import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(404, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, details);
  }
}

export class AuthError extends AppError {
  constructor(message: string, details?: any) {
    super(401, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: any) {
    super(403, message, details);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Error interno del servidor';

  const response: { error: string; details?: any; stack?: string } = {
    error: message,
  };

  if (err instanceof AppError && err.details !== undefined) {
    response.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
