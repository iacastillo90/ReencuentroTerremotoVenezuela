import { Request, Response, NextFunction } from 'express';
import { LocalizadoModel } from '../models/localizado.model';
import { localizadoPayloadSchema } from '../validators/localizado.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { safeRegexQuery } from '../utils/regex-escape.util';
import { toPublicLocalizado } from '../utils/person-view.util';

const MAX_SEARCH_LENGTH = 100;
const MAX_SPECIAL_CHARS = 10;

function isSafeRegexInput(input: string): boolean {
  if (input.length > MAX_SEARCH_LENGTH) return false;
  const specialChars = (input.match(/[.^$*+?{}[\]\\|()]/g) || []).length;
  return specialChars <= MAX_SPECIAL_CHARS;
}

export async function getLocalizados(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, location, limit = '100', offset = '0' } = req.query;

    const filter: any = {};

    if (q && typeof q === 'string') {
      if (!isSafeRegexInput(q)) {
        return res.status(400).json({ error: 'Búsqueda demasiado larga o con demasiados caracteres especiales.' });
      }
      const sanitizedQ = safeRegexQuery(q);
      if (sanitizedQ) {
        const searchRegex = new RegExp(sanitizedQ, 'i');
        filter.$or = [
          { name: searchRegex },
          { cedula: searchRegex }
        ];
      }
    }

    if (location && typeof location === 'string') {
      if (!isSafeRegexInput(location)) {
        return res.status(400).json({ error: 'Búsqueda demasiado larga o con demasiados caracteres especiales.' });
      }
      const sanitizedLocation = safeRegexQuery(location);
      if (sanitizedLocation) {
        filter.location = new RegExp(sanitizedLocation, 'i');
      }
    }

    const maxLimit = Math.min(parseInt(limit as string) || 100, 500);
    const skip = parseInt(offset as string) || 0;

    const data = await LocalizadoModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(maxLimit)
      .lean();

    const viewerRole = req.user?.role;
    const publicData = data.map((d: any) => toPublicLocalizado(d, viewerRole));

    const total = await LocalizadoModel.countDocuments(filter);

    return res.status(200).json({ ok: true, total, offset: skip, limit: maxLimit, data: publicData });
  } catch (error) {
    next(error);
  }
}

export async function postLocalizados(req: Request, res: Response, next: NextFunction) {
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

    const result = await LocalizadoModel.insertMany(data, { ordered: false });

    return res.status(201).json({ ok: true, message: 'Localizados ingested successfully', count: result.length });
  } catch (error: any) {
    if (error.code === 11000) {
       return res.status(201).json({ ok: true, message: 'Ingested with some duplicates skipped' });
    }
    next(error);
  }
}
