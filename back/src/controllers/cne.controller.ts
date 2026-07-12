import { Request, Response, NextFunction } from 'express';
import { CNEValidatorService } from '../services/scrapers/cne-validator.service';

export async function getCneIdentity(req: Request, res: Response, next: NextFunction) {
  try {
    const { nationality, cedula } = req.params as { nationality: 'V' | 'E'; cedula: string };
    const result = await CNEValidatorService.validateIdentity(nationality, cedula);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
