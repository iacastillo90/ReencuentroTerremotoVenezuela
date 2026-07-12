import { Request, Response, NextFunction } from 'express';
import { localizadoPayloadSchema } from '../validators/localizado.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { getLocalizados, postLocalizados } from '../services/localizado.service';

export async function getLocalizadosHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const viewerRole = req.user?.role;
    const result = await getLocalizados(req.query as Record<string, any>, viewerRole);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function postLocalizadosHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = localizadoPayloadSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'POST /localizados validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { data } = validation.data;
    const result = await postLocalizados(data);

    return res.status(201).json({ ok: true, message: 'Localizados ingested successfully', count: result.length });
  } catch (error: any) {
    if (error.code === 11000) {
       return res.status(201).json({ ok: true, message: 'Ingested with some duplicates skipped' });
    }
    next(error);
  }
}
