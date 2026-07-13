/**
 * middlewares/validate.middleware — Middleware de validación Zod
 *
 * PROPÓSITO:
 *   Provee middleware reutilizables para validar parámetros de ruta,
 *   cuerpo (body) y query string contra esquemas Zod, devolviendo
 *   errores en formato uniforme.
 *
 * CARACTERÍSTICAS:
 *   - validateParams: valida req.params
 *   - validateBody: valida req.body
 *   - validateQuery: valida req.query
 *   - Formato de error estandarizado con field y message
 *
 * @module validate.middleware
 */

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
      Object.keys(req.params).forEach(key => delete req.params[key]);
      Object.assign(req.params, parsed);
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
      Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
      Object.assign(req.query, parsed);
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
