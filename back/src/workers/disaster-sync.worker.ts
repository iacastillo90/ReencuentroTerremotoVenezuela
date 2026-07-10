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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

if (mongoose.connection.readyState === 0) {
  console.log(`[disaster-sync] Conectando a MongoDB en ${MONGO_URI}...`);
  mongoose.connect(MONGO_URI)
    .then(() => console.log('[disaster-sync] MongoDB Conectado exitosamente.'))
    .catch((err) => console.error('[disaster-sync] Error al conectar a MongoDB:', err));
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

export const disasterSyncWorker = new Worker('disaster-sync', async (job: Job) => {
  const results = await Promise.allSettled(
    syncJobs.map(async (syncJob) => {
      try {
        await syncJob.handler();
        return { name: syncJob.name, status: 'fulfilled' as const };
      } catch (error) {
        return { name: syncJob.name, status: 'rejected' as const, error };
      }
    })
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount = results.filter(r => r.status === 'rejected').length;
  console.log(`[disaster-sync] Job ${job.id}: ${successCount}/${syncJobs.length} sources synced`);

  if (failCount > 0) {
    results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .forEach(r => console.error(`[disaster-sync] Failed: ${(r.reason as any)?.name || 'unknown'}`, r.reason));
  }
}, {
  connection: connection as any,
  concurrency: getConcurrency(),
});
