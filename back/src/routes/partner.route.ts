import { Router, Request, Response } from 'express';
import { PersonModel } from '../models/unified-person.model';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { connection as redis } from '../config/redis.config';
import { partnerCasesPayloadSchema } from '../validators/partner.validator';
import { auditLog } from '../middlewares/audit.middleware';

export const partnerRouter = Router();

// Endpoint exclusivo para Partners: Extraer TODOS los datos (incluyendo PII sensible)
partnerRouter.get('/cases', requirePartnerApiKey, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const filter: any = {};
    if (status) filter.status = status;

    // A diferencia de la ruta pública, aquí NO aplicamos safeProjection
    // Se envía toda la información sensible (Contactos, Teléfonos, Coordenadas exactas, Cédulas completas)
    const cases = await PersonModel.find(filter)
      .sort({ 'metadata.createdAt': -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await PersonModel.countDocuments(filter);

    return res.status(200).json({ data: cases, total, offset, limit });
  } catch (error) {
    console.error('[PartnerRoute] GET /cases Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint exclusivo para Partners: Inyectar datos al sistema (Bidireccional)
partnerRouter.post('/cases', requirePartnerApiKey, async (req: Request, res: Response) => {
  try {
    const validation = partnerCasesPayloadSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'POST /partner/cases validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { cases } = validation.data;
    const insertedIds = [];
    
    for (const c of cases) {
      // Forzamos que la metadata indique que viene de un Partner API
      const newCase = new PersonModel({
        ...c,
        metadata: {
          ...(c as any).metadata,
          source: 'partner_api',
          auditStatus: 'pending_review',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      await newCase.save();
      insertedIds.push(newCase._id);
    }

    // Invalida la cache pública al inyectar nuevos casos
    await redis.keys('persons:*').then(keys => {
      if (keys.length > 0) return redis.del(...keys);
    });

    auditLog({
      eventType: 'ingestion_partner',
      severity: 'info',
      actor: 'system',
      action: 'POST /partner/cases',
      detail: { count: insertedIds.length },
      req,
    });

    return res.status(201).json({ message: 'Cases successfully ingested', insertedIds });
  } catch (error) {
    console.error('[PartnerRoute] POST /cases Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
