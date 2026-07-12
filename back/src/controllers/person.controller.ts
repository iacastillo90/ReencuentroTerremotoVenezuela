import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { personPayloadSchema } from '../validators/person.validator';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { PersonModel } from '../models/unified-person.model';
import { AuditLogModel } from '../models/audit-log.model';
import { connection as redis } from '../config/redis.config';
import { ValidationError } from '../middlewares/error.middleware';
import { safeRegexQuery } from '../utils/regex-escape.util';
import { toPublicPerson } from '../utils/person-view.util';

const closeCaseSchema = z.object({
  resolution: z.enum(['found', 'deceased', 'erroneous']),
  notes: z.string().max(2000).optional(),
});

export async function getCounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const CACHE_KEY = 'persons:counts';
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.status(200).json(JSON.parse(cached));

    const LOCK_KEY = CACHE_KEY + ':lock';
    const lockAcquired = await redis.set(LOCK_KEY, '1', 'PX', 10000, 'NX');
    if (!lockAcquired) {
      await new Promise(r => setTimeout(r, 200));
      const recheck = await redis.get(CACHE_KEY);
      if (recheck) return res.status(200).json(JSON.parse(recheck));
    }

    try {
      const [missing, found, total, pending, manual, animals] = await Promise.all([
        PersonModel.countDocuments({ status: 'missing', type: { $ne: 'animal' }, 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
        PersonModel.countDocuments({ status: 'found', type: { $ne: 'animal' }, 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
        PersonModel.countDocuments({ 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
        PersonModel.countDocuments({ 'metadata.auditStatus': 'pending_review' }),
        PersonModel.countDocuments({ 'metadata.source': 'manual' }),
        PersonModel.countDocuments({ type: 'animal', 'metadata.auditStatus': { $ne: 'pending_moderation' } })
      ]);

      const counts = { missing, found, total, pending, manual, animals };
      await redis.setex(CACHE_KEY, 300, JSON.stringify(counts));

      return res.status(200).json(counts);
    } finally {
      await redis.del(LOCK_KEY).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
}

export async function getMyReports(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const safeProjection = {
      idHash: 1,
      type: 1,
      name: 1,
      status: 1,
      'lastSeen.state': 1,
      'lastSeen.municipality': 1,
      'lastSeen.description': 1,
      'lastSeen.date': 1,
      'lastSeen.coordinates': 1,
      age: 1,
      gender: 1,
      description: 1,
      photoUrl: 1,
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1
    };

    const [persons, total] = await Promise.all([
      PersonModel.find({ 'metadata.reportedBy': userId })
        .select(safeProjection)
        .sort({ 'metadata.createdAt': -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      PersonModel.countDocuments({ 'metadata.reportedBy': userId }),
    ]);

    return res.status(200).json({ data: persons, total, limit, offset });
  } catch (error) {
    next(error);
  }
}

export async function getPersons(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, status, category, state, municipality } = req.query;

    const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const filter: any = { 'metadata.auditStatus': { $ne: 'pending_moderation' } };

    if (status) {
      filter.status = status;
    }

    if (q && typeof q === 'string') {
      const sanitizedQuery = safeRegexQuery(q);
      if (sanitizedQuery) {
        filter.normalizedName = { $regex: '^' + sanitizedQuery, $options: 'i' };
      }
    }

    if (category) {
      if (category === 'mascota') {
        filter.type = 'animal';
      } else if (category === 'nino') {
        filter.type = 'person';
        filter.age = { $lt: 18 };
      } else if (category === 'adulto') {
        filter.type = 'person';
        filter.age = { $gte: 18, $lt: 65 };
      } else if (category === 'adulto_mayor') {
        filter.type = 'person';
        filter.age = { $gte: 65 };
      }
    }

    if (state && typeof state === 'string') {
      filter['lastSeen.state'] = state;
    }
    if (municipality && typeof municipality === 'string') {
      filter['lastSeen.municipality'] = { $regex: safeRegexQuery(municipality), $options: 'i' };
    }

    const cacheKey = `persons:q=${q || ''}:status=${status || ''}:cat=${category || ''}:st=${state || ''}:m=${municipality || ''}:l=${limit}:o=${offset}`;

    if (!q && offset === 0) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    }

    const safeProjection = {
      idHash: 1,
      type: 1,
      name: 1,
      status: 1,
      'lastSeen.state': 1,
      'lastSeen.municipality': 1,
      'lastSeen.description': 1,
      'lastSeen.date': 1,
      'lastSeen.coordinates': 1,
      age: 1,
      gender: 1,
      description: 1,
      photoUrl: 1,
      'data.origen': 1,
      'data.ficha_url': 1,
      'data.verificado_por': 1,
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1,
      'metadata.reportedBy': 1,
      'metadata.isMinor': 1
    };

    const [rawPersons, total] = await Promise.all([
      PersonModel.find(filter)
        .select(safeProjection)
        .populate('metadata.reportedBy', 'name')
        .sort({ photoUrl: -1, 'metadata.urgencyScore': -1, 'metadata.createdAt': -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      PersonModel.countDocuments(filter)
    ]);

    const viewerRole = req.user?.role;
    const persons = rawPersons.map((p: any) => toPublicPerson(p, viewerRole));

    const responsePayload = { total, limit, offset, persons };

    if (!q && offset === 0) {
      await redis.setex(cacheKey, 30, JSON.stringify(responsePayload));
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
}

export async function createPerson(req: Request, res: Response, next: NextFunction) {
  try {
    const validationResult = personPayloadSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Error de validación',
        details: validationResult.error.issues
      });
    }

    const payload: any = validationResult.data;
    if (!payload.isAnonymous) {
      payload.reportedBy = req.user!.userId;
    }
    payload.reporterIp = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';
    const updatedAt = payload.date ? new Date(payload.date) : new Date();

    const syncState = await checkSyncState(
      payload.source,
      payload.externalId,
      payload,
      updatedAt
    );

    if (syncState.status === 'skipped') {
      return res.status(200).json({
        message: 'Record skipped, no changes detected.',
        status: 'skipped'
      });
    }

    await addJobToIAQueue(payload);

    return res.status(202).json({
      message: 'Record accepted for processing.',
      status: 'queued'
    });

  } catch (error) {
    next(error);
  }
}

export async function closeCase(req: Request, res: Response, next: NextFunction) {
  try {
    const { idHash } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const parsed = closeCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Resolución inválida', { errors: parsed.error.issues }));
    }
    const { resolution, notes } = parsed.data;

    const person = await PersonModel.findOne({ idHash });
    if (!person) return res.status(404).json({ error: 'Reporte no encontrado.' });

    const isOwner = person.metadata?.reportedBy?.toString() === userId;
    if (!isOwner && userRole !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para cerrar este caso.' });
    }

    const prevStatus = person.status;
    person.status = resolution === 'erroneous' ? 'unknown' : resolution;

    if (resolution === 'erroneous') {
      person.metadata.auditStatus = 'dismissed';
    }

    await person.save();

    await AuditLogModel.create({
      eventType: 'admin_action' as const,
      severity: 'info' as const,
      actor: userId as string,
      action: 'case_closed' as string,
      resource: idHash as string,
      detail: {
        previousStatus: prevStatus,
        newStatus: person.status,
        resolutionNotes: notes,
      },
      ip: (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown',
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown',
      timestamp: new Date(),
    });

    await redis.del('persons:counts');

    return res.status(200).json({ message: 'Caso cerrado exitosamente.', status: person.status });
  } catch (error) {
    next(error);
  }
}
