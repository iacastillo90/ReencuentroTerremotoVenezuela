import { Request, Response, NextFunction } from 'express';
import { CNEValidatorService } from '../services/scrapers/cne-validator.service';

export async function getCneIdentity(req: Request, res: Response, next: NextFunction) {
  try {
    const nationality = req.params.nationality as string;
    const cedula = req.params.cedula as string;

    if (!['V', 'E'].includes(nationality.toUpperCase())) {
      return res.status(400).json({ error: 'Nacionalidad debe ser V o E' });
    }

    const result = await CNEValidatorService.validateIdentity(nationality as 'V'|'E', cedula);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
