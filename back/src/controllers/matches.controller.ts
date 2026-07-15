/**
 * controllers/matches.controller.ts — Consulta de matches por reporte
 *
 * PROPÓSITO:
 *   Proporciona los matches (coincidencias) generados para un reporte
 *   de persona específico. El usuario autenticado solo ve matches de
 *   sus propios reportes (a menos que sea admin).
 *
 * CARACTERÍSTICAS:
 *   - getMatchesByReport: Devuelve matches ordenados por score descendente
 *   - Filtro por userId: Usuarios regulares solo ven sus propios matches
 *   - Admin puede ver matches de cualquier reporte
 *
 * FLUJO DE DATOS:
 *   1. req.params.reportId → ID del reporte
 *   2. req.user.userId → usuario autenticado
 *   3. matches.service.getMatchesByReport(reportId, userId, userRole)
 *   4. Retorna arreglo de matches con score, persona, estado
 *
 * SEGURIDAD:
 *   - requireUser: Solo usuarios autenticados
 *   - userId check: Previene acceso a matches de otros usuarios
 *   - Admin bypass: role check permite acceso total
 *
 * ENDPOINT:
 *   GET /api/matches/:reportId
 *
 * @module matches.controller
 */
import { Request, Response, NextFunction } from 'express';
import { getMatchesByReport as getMatchesByReportService } from '../services/matches.service';

export async function getMatchesByReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as { userId: string }).userId;
    const userRole = (req.user as { role?: string }).role ?? 'user';
    const reportId = (req.params as Record<string, string>).reportId;
    const result = await getMatchesByReportService(reportId, userId, userRole);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
