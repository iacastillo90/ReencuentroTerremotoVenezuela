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
