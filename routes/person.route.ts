import { Router, Request, Response } from 'express';
import { personPayloadSchema } from '../validators/person.validator';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { PersonModel } from '../models/unified-person.model';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, status } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (q && typeof q === 'string') {
      const normalizedQuery = q.trim().toLowerCase();
      filter.normalizedName = { $regex: normalizedQuery, $options: 'i' };
    }

    // Proyección segura: excluir PII, contactPerson, externalIds
    const safeProjection = {
      name: 1,
      status: 1,
      'lastSeen.state': 1,
      'lastSeen.municipality': 1,
      'lastSeen.description': 1,
      'lastSeen.date': 1,
      age: 1,
      gender: 1,
      description: 1,
      photoUrl: 1,
      'metadata.createdAt': 1,
      'metadata.urgencyScore': 1
    };

    const persons = await PersonModel.find(filter)
      .select(safeProjection)
      .limit(50)
      .sort({ 'metadata.urgencyScore': -1, 'metadata.createdAt': -1 })
      .lean();

    return res.status(200).json(persons);
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
