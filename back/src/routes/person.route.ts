import { Router, Request, Response } from 'express';
import { personPayloadSchema } from '../validators/person.validator';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { PersonModel } from '../models/unified-person.model';
import { connection as redis } from '../config/redis.config';

const router = Router();

// ── GET /counts — Totales por estado (cacheado 5 min) ──────────────────────
router.get('/counts', async (_req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('[PersonRoute] GET /counts Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, status } = req.query;

    // Paginación — máx 200 por página
    const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (q && typeof q === 'string') {
      const normalizedQuery = q.trim().toLowerCase();
      filter.normalizedName = { $regex: normalizedQuery, $options: 'i' };
    }

    const cacheKey = `persons:q=${q || ''}:status=${status || ''}:l=${limit}:o=${offset}`;

    // Solo cachear primera página sin búsqueda activa
    if (!q && offset === 0) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    }

    // Proyección segura: excluir PII, contactPerson, externalIds
    const safeProjection = {
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
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1
    };

    // Prioridad: con foto primero, luego por urgencia
    const [persons, total] = await Promise.all([
      PersonModel.find(filter)
        .select(safeProjection)
        .sort({ photoUrl: -1, 'metadata.urgencyScore': -1, 'metadata.createdAt': -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      PersonModel.countDocuments(filter)
    ]);

    const responsePayload = { total, limit, offset, persons };

    // Cachear solo primera página sin búsqueda (30s)
    if (!q && offset === 0) {
      await redis.setex(cacheKey, 30, JSON.stringify(responsePayload));
    }

    return res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error('[PersonRoute] GET Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    // 1. Validate payload
    const validationResult = personPayloadSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationResult.error.issues
      });
    }

    const payload = validationResult.data;
    const updatedAt = payload.date ? new Date(payload.date) : new Date();

    // 2. Check Deduplication / SyncState
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

    // 3. Add to Queue for processing
    await addJobToIAQueue(payload);

    return res.status(202).json({
      message: 'Record accepted for processing.',
      status: 'queued'
    });

  } catch (error: any) {
    console.error('[PersonRoute] POST Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const personRouter = router;
