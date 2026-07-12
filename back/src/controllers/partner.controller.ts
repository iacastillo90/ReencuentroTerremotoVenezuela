import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { connection as redis } from '../config/redis.config';
import { partnerCasesPayloadSchema } from '../validators/partner.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { upsertPerson } from '../services/person.service';
import { getPartnerCases } from '../services/partner.service';

export async function getPartnerCasesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const filter: any = {};
    if (status) filter.status = status;

    const result = await getPartnerCases(filter, limit, offset);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postPartnerCasesHandler(req: Request, res: Response, next: NextFunction) {
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
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { cases } = validation.data;
    const insertedIds: string[] = [];

    for (const c of cases) {
      const { name, status, age, gender, description, photoUrl, aliases, contactPerson } = c;
      const lastSeen = c.lastSeen ? { ...c.lastSeen, description: c.lastSeen.description || '', date: c.lastSeen.date ? new Date(c.lastSeen.date) : new Date() } : undefined;
      const externalId = `partner-${crypto.createHash('sha256').update(name + (lastSeen?.state || '') + (age || 0)).digest('hex').slice(0, 16)}`;

      const result = await upsertPerson(
        'partner_api',
        externalId,
        {
          type: 'person',
          name,
          normalizedName: name.toLowerCase(),
          status,
          age,
          gender,
          description,
          lastSeen,
          photoUrl,
          aliases: aliases?.filter((a): a is string => !!a),
          contactPerson,
          metadata: {
            urgencyScore: (c as any).metadata?.urgencyScore,
            confidenceScore: (c as any).metadata?.confidenceScore,
            confidenceLabel: (c as any).metadata?.confidenceLabel,
            source: 'partner_api',
            auditStatus: 'pending_review',
            aiProcessed: false,
            isMinor: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSync: new Date(),
          }
        }
      );
      insertedIds.push((result as any)._id?.toString() || result.idHash);
    }

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
    next(error);
  }
}
