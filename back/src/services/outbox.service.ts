import { OutboxModel } from '../models/outbox.model';
import { personMatchingQueue } from '../queues/person-matching.queue';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { addJobToManualAudit } from '../queues/manual-audit.queue';
import { logger } from '../utils/logger.util';

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000;

export async function addToOutbox(
  type: 'person-matching' | 'manual-audit' | 'ia-processing',
  payload: Record<string, unknown>
): Promise<void> {
  await OutboxModel.create({ type, payload });
}

export async function processOutbox(): Promise<number> {
  const events = await OutboxModel.find({ status: 'pending', attempts: { $lt: 5 } })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  let processed = 0;

  for (const event of events) {
    event.status = 'processing';
    event.attempts += 1;
    await event.save();

    try {
      switch (event.type) {
        case 'person-matching':
          await personMatchingQueue.enqueue(event.payload as { idHash: string; source: string });
          break;
        case 'manual-audit':
          await addJobToManualAudit(event.payload);
          break;
        case 'ia-processing':
          await addJobToIAQueue(event.payload);
          break;
      }

      event.status = 'completed';
      event.processedAt = new Date();
      await event.save();
      processed++;
    } catch (error: any) {
      logger.error({ err: error, eventId: event._id, type: event.type }, 'Outbox processing failed');

      if (event.attempts >= event.maxAttempts) {
        event.status = 'failed';
        event.lastError = error?.message || 'Unknown error';
      } else {
        event.status = 'pending';
        event.lastError = error?.message || 'Unknown error';
      }
      await event.save();
    }
  }

  return processed;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startOutboxProcessor(): void {
  if (intervalHandle) return;
  logger.info('[Outbox] Starting outbox processor');
  intervalHandle = setInterval(async () => {
    try {
      const count = await processOutbox();
      if (count > 0) {
        logger.info({ processed: count }, '[Outbox] Events processed');
      }
    } catch (error: any) {
      logger.error({ err: error }, '[Outbox] Processing cycle error');
    }
  }, POLL_INTERVAL_MS);
}

export function stopOutboxProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[Outbox] Processor stopped');
  }
}
