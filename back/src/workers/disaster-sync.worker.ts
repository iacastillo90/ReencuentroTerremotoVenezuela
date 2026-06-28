import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis.config';
import { fetchUSGSEarthquakes } from '../jobs/usgs.job';
import { fetchFIRMSFires } from '../jobs/firms.job';
import { fetchGDACS } from '../jobs/gdacs.job';
import { fetchAyudaVEPersons } from '../jobs/ayudave.job';

export const disasterSyncWorker = new Worker('disaster-sync', async (job: Job) => {
  if (job.name === 'sync-usgs') {
    console.log(`[Worker] Starting USGS Sync Job ${job.id}`);
    await fetchUSGSEarthquakes();
  } else if (job.name === 'sync-firms') {
    console.log(`[Worker] Starting FIRMS Sync Job ${job.id}`);
    await fetchFIRMSFires();
  } else if (job.name === 'sync-gdacs') {
    console.log(`[Worker] Starting GDACS Sync Job ${job.id}`);
    await fetchGDACS();
  } else if (job.name === 'sync-ayudave') {
    console.log(`[Worker] Starting AyudaVE Sync Job ${job.id}`);
    await fetchAyudaVEPersons();
  }
}, { connection: connection as any });
