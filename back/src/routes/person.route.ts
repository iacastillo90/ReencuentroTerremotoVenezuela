import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { personPayloadSchema } from '../validators/person.validator';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { PersonModel } from '../models/unified-person.model';
import { AuditLogModel } from '../models/audit-log.model';
import { connection as redis } from '../config/redis.config';
import { requireProfileComplete, requireUser } from '../middlewares/auth.middleware';
import { ValidationError } from '../middlewares/error.middleware';
import { safeRegexQuery } from '../utils/regex-escape.util';

const closeCaseSchema = z.object({
  resolution: z.enum(['found', 'deceased', 'erroneous']),
  notes: z.string().max(2000).optional(),
});

const router = Router();

// ── GET /counts — Totales por estado (cacheado 5 min) ──────────────────────
router.get('/counts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const CACHE_KEY = 'persons:counts';
    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.status(200).json(JSON.parse(cached));

    const [missing, found, total, pending, manual] = await Promise.all([
      PersonModel.countDocuments({ status: 'missing' }),
      PersonModel.countDocuments({ status: 'found' }),
      PersonModel.countDocuments({}),
      PersonModel.countDocuments({ 'metadata.auditStatus': 'pending_review' }),
      PersonModel.countDocuments({ 'metadata.source': 'manual' })
    ]);

    const counts = { missing, found, total, pending, manual };
    await redis.setex(CACHE_KEY, 300, JSON.stringify(counts));

    return res.status(200).json(counts);
  } catch (error) {
    next(error);
  }
});

// ── GET /mine — Obtener reportes del usuario autenticado ───────────────────
router.get('/mine', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const safeProjection = {
      idHash: 1,
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
      'data.cedula': 1,
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1
    };

    const persons = await PersonModel.find({ 'metadata.reportedBy': userId })
      .select(safeProjection)
      .sort({ 'metadata.createdAt': -1 })
      .lean();

    return res.status(200).json(persons);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, status } = req.query;

    const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (q && typeof q === 'string') {
      const sanitizedQuery = safeRegexQuery(q);
      if (sanitizedQuery) {
        filter.normalizedName = { $regex: sanitizedQuery, $options: 'i' };
      }
    }

    const cacheKey = `persons:q=${q || ''}:status=${status || ''}:l=${limit}:o=${offset}`;

    if (!q && offset === 0) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    }

    const safeProjection = {
      idHash: 1,
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
      'data.cedula': 1,
      'data.origen': 1,
      'data.ficha_url': 1,
      'data.verificado_por': 1,
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1,
      'metadata.reportedBy': 1
    };

    const [persons, total] = await Promise.all([
      PersonModel.find(filter)
        .select(safeProjection)
        .populate('metadata.reportedBy', 'name')
        .sort({ photoUrl: -1, 'metadata.urgencyScore': -1, 'metadata.createdAt': -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      PersonModel.countDocuments(filter)
    ]);

    const responsePayload = { total, limit, offset, persons };

    if (!q && offset === 0) {
      await redis.setex(cacheKey, 30, JSON.stringify(responsePayload));
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireProfileComplete, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = personPayloadSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationResult.error.issues
      });
    }

    const payload = validationResult.data;
    if (!payload.isAnonymous) {
      payload.reportedBy = (req as any).user.userId;
    }
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
});

// ── POST /:idHash/close — Cerrar caso (Fase 4 Auditoría Legal) ───────────────
router.post('/:idHash/close', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idHash } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

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
});

export const personRouter = router;
