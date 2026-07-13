/**
 * workers/disaster-sync.worker.ts — Worker de sincronización de desastres
 *
 * PROPÓSITO:
 *   Worker BullMQ que ejecuta un ciclo completo de sincronización de
 *   desastres. Obtiene datos de hasta 10 fuentes externas (USGS,
 *   FIRMS, GDACS, FUNVISIS, INAMEH, CORPOELEC, etc.) en secuencia,
 *   con un delay de 2s entre cada una para no saturar las APIs.
 *
 * CARACTERÍSTICAS:
 *   - 10 sync jobs en secuencia (con delay de 2s entre cada uno)
 *   - connectDB al inicio (modo Worker)
 *   - Concurrencia configurable via DISASTER_SYNC_CONCURRENCY (default 3)
 *   - Reporte de éxito/fallo por job
 *   - Graceful: Fallos individuales no detienen el ciclo
 *
 * FLUJO:
 *   1. BullMQ envía job 'disaster-sync'
 *   2. Worker ejecuta cada syncJob.handler() en secuencia
 *   3. 2s de delay entre jobs para rate limiting
 *   4. Log de resumen con successCount / failCount
 *   5. Fallos se loggean individualmente como error
 *
 * FUENTES SINCRONIZADAS:
 *   USGS Earthquakes, FIRMS Fires, GDACS, Reencuentro Persons,
 *   Venezuela Reporta, FUNVISIS, INAMEH, CORPOELEC, Protección Civil,
 *   Cruz Roja
 *
 * @module disaster-sync.worker
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { connectDB } from '../database/connection';
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

connectDB('Worker');

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
