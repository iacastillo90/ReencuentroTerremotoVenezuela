import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis.config';
import { fetchUSGSEarthquakes } from '../jobs/usgs.job';
import { fetchFIRMSFires } from '../jobs/firms.job';
import { fetchGDACS } from '../jobs/gdacs.job';
import { fetchReencuentroPersons } from '../jobs/reencuentro.job';
import { fetchVenezuelaReporta } from '../jobs/venezuelareporta.job';
import { runFunvisisJob } from '../jobs/funvisis.job';
import { runInamehJob } from '../jobs/inameh.job';
import { runCorpoelecJob } from '../jobs/corpoelec.job';
import { runProteccionCivilJob } from '../jobs/proteccion-civil.job';
import { runCruzRojaJob } from '../jobs/cruz-roja.job';
import { logger } from '../utils/logger.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

if (mongoose.connection.readyState === 0) {
  logger.info({ mongoUri: MONGO_URI }, '[disaster-sync] Connecting to MongoDB...');
  mongoose.connect(MONGO_URI)
    .then(() => logger.info('[disaster-sync] MongoDB connected'))
    .catch((err) => logger.error({ err }, '[disaster-sync] MongoDB connection error'));
}

interface SyncJob {
  name: string;
  handler: () => Promise<void>;
}

function getConcurrency(): number {
  const envVal = process.env.DISASTER_SYNC_CONCURRENCY;
  if (envVal === undefined) return 3;
  const parsed = parseInt(envVal, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

const syncJobs: SyncJob[] = [
  { name: 'USGS Earthquakes', handler: fetchUSGSEarthquakes },
  { name: 'FIRMS Fires', handler: fetchFIRMSFires },
  { name: 'GDACS', handler: fetchGDACS },
  { name: 'Reencuentro Persons', handler: fetchReencuentroPersons },
  { name: 'Venezuela Reporta', handler: fetchVenezuelaReporta },
  { name: 'FUNVISIS', handler: runFunvisisJob },
  { name: 'INAMEH', handler: runInamehJob },
  { name: 'CORPOELEC', handler: runCorpoelecJob },
  { name: 'Proteccion Civil', handler: runProteccionCivilJob },
  { name: 'Cruz Roja', handler: runCruzRojaJob },
];

const SYNC_DELAY_MS = 2000;

export const disasterSyncWorker = new Worker('disaster-sync', async (job: Job) => {
  const results: Array<{ name: string; status: 'fulfilled' | 'rejected'; error?: any }> = [];

  for (const syncJob of syncJobs) {
    try {
      await syncJob.handler();
      results.push({ name: syncJob.name, status: 'fulfilled' });
    } catch (error) {
      results.push({ name: syncJob.name, status: 'rejected', error });
    }
    await new Promise(r => setTimeout(r, SYNC_DELAY_MS));
  }

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount = results.filter(r => r.status === 'rejected').length;
  logger.info({ jobId: job.id, successCount, total: syncJobs.length }, '[disaster-sync] Sync cycle completed');

  if (failCount > 0) {
    results
      .filter(r => r.status === 'rejected')
      .forEach(r => logger.error({ job: r.name, err: r.error }, '[disaster-sync] Sync failed'));
  }
}, {
  connection: connection as any,
  concurrency: getConcurrency(),
});
