/**
 * controllers/cne.controller.ts — Validación de cédula con el CNE
 *
 * PROPÓSITO:
 *   Endpoint público (con rate limiting) para validar una cédula de
 *   identidad venezolana contra el portal del CNE. Útil para verificar
 *   la identidad de una persona reportada usando datos electorales.
 *
 * CARACTERÍSTICAS:
 *   - validateIdentity: Consulta CNE por nacionalidad + número de cédula
 *   - Soporte para V (venezolano) y E (extranjero)
 *   - Sin persistencia: es una consulta en caliente
 *
 * SEGURIDAD:
 *   - Rate limiting en ruta: Previene scraping masivo
 *   - No cachea resultados: Datos consultados siempre frescos
 *   - No expone información sensible adicional
 *
 * ENDPOINT:
 *   GET /api/cne/:nationality/:cedula
 *
 * @module cne.controller
 */
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
