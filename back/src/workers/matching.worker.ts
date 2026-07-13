import { Worker } from 'bullmq';
import { connection } from '../config/redis.config';
import { runMatchingForNewPerson } from '../services/matcher.service';
import { logger } from '../utils/logger.util';

export const personMatchingWorker = new Worker('person-matching', async (job) => {
  const { idHash, source } = job.data;
  logger.info({ idHash, source }, '[matching-worker] Processing match');
  try {
    await runMatchingForNewPerson(idHash);
  } catch (error) {
    logger.error({ err: error, idHash, source }, '[matching-worker] Failed to process match');
  }
}, { connection: connection as any });
