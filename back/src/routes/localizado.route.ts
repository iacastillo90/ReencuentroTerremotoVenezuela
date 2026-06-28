import { Router, Request, Response } from 'express';
import { LocalizadoModel } from '../models/localizado.model';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { localizadoPayloadSchema } from '../validators/localizado.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { safeRegexQuery } from '../utils/regex-escape.util';

export const localizadoRouter = Router();

// GET /api/localizados - Búsqueda de personas localizadas en hospitales (abierto al público)
localizadoRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { q, location, limit = '100', offset = '0' } = req.query;
    
    const filter: any = {};
    
    if (q && typeof q === 'string') {
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

    const total = await LocalizadoModel.countDocuments(filter);

    return res.status(200).json({ ok: true, total, offset: skip, limit: maxLimit, data });
  } catch (error) {
    console.error('[LocalizadoRoute] GET / Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/localizados - Ingesta de listados masivos (solo partners)
localizadoRouter.post('/', requirePartnerApiKey, async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { data } = validation.data;

    // Insertar masivamente para optimizar rendimiento
    const result = await LocalizadoModel.insertMany(data, { ordered: false });
    
    return res.status(201).json({ ok: true, message: 'Localizados ingested successfully', count: result.length });
  } catch (error: any) {
    // Si hay errores de duplicidad u otros al usar insertMany con ordered:false, lo capturamos
    if (error.code === 11000) {
       return res.status(201).json({ ok: true, message: 'Ingested with some duplicates skipped' });
    }
    console.error('[LocalizadoRoute] POST / Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
