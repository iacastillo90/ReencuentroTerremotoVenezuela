/**
 * controllers/partner.controller.ts — API de integración con partners
 *
 * PROPÓSITO:
 *   Endpoints para integración con organizaciones aliadas (ONGs,
 *   protección civil, etc.). Los partners envían casos de personas
 *   desaparecidas/encontradas via POST, y pueden consultar casos
 *   existentes via GET. Autenticación via x-partner-api-key.
 *
 * CARACTERÍSTICAS:
 *   - getPartnerCasesHandler: Consulta paginada con filtro por status
 *   - postPartnerCasesHandler: Ingesta masiva de casos via upsertPerson
 *   - Cache invalidation: Invalida cache Redis 'persons:*' tras ingesta
 *   - Audit log: Registra ingestiones exitosas
 *   - externalId: Generado con SHA-256 (name + estado + edad), deterministico
 *
 * FLUJO DE INGESTA:
 *   1. Partner envía POST /api/partner/cases con arreglo de casos
 *   2. partnerCasesPayloadSchema valida con Zod
 *   3. Por cada caso: upsertPerson('partner_api', externalId, data)
 *   4. Redis cache invalidation: persons:* keys eliminadas
 *   5. Audit log con conteo de casos insertados
 *   6. Respuesta 201 con array de IDs insertados
 *
 * SEGURIDAD:
 *   - x-partner-api-key: Solo partners autorizados (CSRF exento)
 *   - Zod validation en cada payload
 *   - ExternalId deterministico: Previene duplicados
 *   - Audit log completo (validación fallida y exitosa)
 *   - Cache invalidation forzada: Datos frescos siempre
 *   - Limit en GET: Máximo 1000 resultados
 *
 * ENDPOINTS:
 *   GET  /api/partner/cases — Consultar casos
 *   POST /api/partner/cases — Ingresar casos
 *
 * @module partner.controller
 */
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
