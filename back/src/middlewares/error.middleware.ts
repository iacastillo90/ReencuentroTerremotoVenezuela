/**
 * middlewares/error.middleware.ts — Manejo global de errores
 *
 * PROPÓSITO:
 *   Define clases de error personalizadas (AppError, NotFound, Validation,
 *   Auth, Forbidden) y un middleware global de error handler que captura
 *   errores en toda la aplicación y devuelve respuestas JSON consistentes.
 *
 * CLASES DE ERROR:
 *   - AppError: Clase base con statusCode y details opcionales
 *   - NotFoundError: 404 — Recurso no encontrado
 *   - ValidationError: 400 — Datos inválidos
 *   - AuthError: 401 — No autenticado
 *   - ForbiddenError: 403 — Sin permisos suficientes
 *
 * FLUJO DE ERROR HANDLER:
 *   1. Express pasa errores al middleware (next(err))
 *   2. ¿headersSent? → Pasar al siguiente (no podemos cambiar response)
 *   3. ¿instanceof AppError? → Usar statusCode y message de la clase
 *   4. ¿No es AppError? → 500 genérico (error interno del servidor)
 *   5. Incluir details si es AppError con detalles
 *   6. Incluir stack trace solo en desarrollo (NODE_ENV !== 'production')
 *
 * SEGURIDAD:
 *   - Stack trace NUNCA expuesto en producción (fuga de información interna)
 *   - Error 500 genérico: No revela detalles de implementación
 *   - Details controlados: Solo se exponen los que AppError define explícitamente
 *
 * DECISIONES TÉCNICAS:
 *   - Class hierarchy sobre union types: instanceof check es más legible
 *   - headersSent guard: Previene "Cannot set headers after they are sent"
 *   - Stack en desarrollo: Facilita debugging sin comprometer producción
 *   - AppError.details: Tipado flexible (cualquier metadata útil)
 *
 * CÓMO USAR:
 *   throw new NotFoundError('Usuario no encontrado');
 *   throw new ValidationError('Datos inválidos', { errors: zodError.issues });
 *   next(err); // Express pasa automáticamente al errorHandler
 */
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
