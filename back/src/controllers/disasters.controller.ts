import { Request, Response, NextFunction } from 'express';
import { queryDisasters, getActiveDisasters, disasterQuerySchema } from '../services/disaster-events.service';

export async function getDisasters(req: Request, res: Response, next: NextFunction) {
  try {
    const queryValidation = disasterQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: 'Parámetros de consulta inválidos', details: queryValidation.error.issues });
    }

    const disasters = await queryDisasters(queryValidation.data);

    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
}

export async function getActiveDisastersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const disasters = await getActiveDisasters();
    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
}
