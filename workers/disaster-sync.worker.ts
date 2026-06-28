import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis.config';
import { fetchUSGSEarthquakes } from '../jobs/usgs.job';

export const disasterSyncWorker = new Worker('disaster-sync', async (job: Job) => {
  if (job.name === 'sync-usgs') {
    console.log(`[Worker] Starting USGS Sync Job ${job.id}`);
    await fetchUSGSEarthquakes();
  }
}, { connection: connection as any });
