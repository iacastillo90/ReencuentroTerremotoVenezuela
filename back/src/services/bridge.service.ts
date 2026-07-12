import { iaProcessQueue } from '../queues/ia-process.queue';
import { legacyStore } from './legacy/legacy.store';
import { logger } from '../utils/logger.util';

export async function ingestDualWrite(records: any[]): Promise<void> {
  if (!records || records.length === 0) return;

  try {
    await legacyStore.upsertMediaBatch(records);
    logger.info({ count: records.length }, '[bridge] Records persisted to legacy SQL');
  } catch (error: any) {
    logger.error({ err: error }, '[bridge] Legacy SQL persistence failed');
    throw error;
  }

  try {
    const jobs = records.map(record => ({ name: 'process', data: record }));
    await iaProcessQueue.addBulk(jobs);
    logger.info({ count: records.length }, '[bridge] Records enqueued to ia-process');
  } catch (error: any) {
    logger.error({ err: error }, '[bridge] Error enqueuing to IA queue');
  }
}
