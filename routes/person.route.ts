import { Router, Request, Response } from 'express';
import { personPayloadSchema } from '../validators/person.validator';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';

const router = Router();

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
