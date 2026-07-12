import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

function formatZodError(error: any) {
  const issues = error.issues || [];
  return {
    error: 'Parámetros inválidos',
    details: issues.map((e: any) => ({
      field: e.path?.join('.') || '',
      message: e.message
    }))
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      req.params = parsed as any;
      next();
    } catch (error: any) {
      if (error?.issues || error?.name === 'ZodError') {
        return res.status(400).json(formatZodError(error));
      }
      next(error);
    }
  };
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error?.issues || error?.name === 'ZodError') {
        return res.status(400).json({
          error: 'Datos inválidos',
          details: (error.issues || []).map((e: any) => ({
            field: e.path?.join('.') || '',
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed as any;
      next();
    } catch (error: any) {
      if (error?.issues || error?.name === 'ZodError') {
        return res.status(400).json({
          error: 'Parámetros de consulta inválidos',
          details: (error.issues || []).map((e: any) => ({
            field: e.path?.join('.') || '',
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}
