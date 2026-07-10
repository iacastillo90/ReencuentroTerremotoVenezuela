import { Worker } from 'bullmq';
import { connection } from '../config/redis.config';
import { runMatchingForNewPerson } from '../services/matcher.service';

export const personMatchingWorker = new Worker('person-matching', async (job) => {
  const { idHash, source } = job.data;
  console.log(`[matching-worker] Processing match for ${idHash} (source: ${source})`);
  await runMatchingForNewPerson(idHash);
}, { connection: connection as any });
