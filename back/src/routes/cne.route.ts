import { Router, Request, Response } from 'express';
import { CNEValidatorService } from '../services/scrapers/cne-validator.service';

export const cneRouter = Router();

// GET /api/cne/:nationality/:cedula
// Ejemplo: /api/cne/V/25000001
cneRouter.get('/:nationality/:cedula', async (req: Request, res: Response) => {
  try {
    const { nationality, cedula } = req.params;
    
    if (!['V', 'E'].includes(nationality.toUpperCase())) {
      return res.status(400).json({ error: 'Nacionalidad debe ser V o E' });
    }

    const result = await CNEValidatorService.validateIdentity(nationality as 'V'|'E', cedula);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[CNE Route] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
