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
import { runBiometricSweepJob } from '../jobs/biometric-sweep.job';
import { runLopnnaSweepJob } from '../jobs/lopnna-sweep.job';
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

const jobHandlers: Record<string, () => Promise<any>> = {
  'sync-usgs': fetchUSGSEarthquakes,
  'sync-firms': fetchFIRMSFires,
  'sync-gdacs': fetchGDACS,
  'sync-reencuentro': fetchReencuentroPersons,
  'sync-venezuelareporta': fetchVenezuelaReporta,
  'sync-funvisis': runFunvisisJob,
  'sync-inameh': runInamehJob,
  'sync-corpoelec': runCorpoelecJob,
  'sync-proteccion-civil': runProteccionCivilJob,
  'sync-cruz-roja': runCruzRojaJob,
  'sync-biometric-sweep': runBiometricSweepJob,
  'sync-lopnna-sweep': runLopnnaSweepJob,
};

export const disasterSyncWorker = new Worker('disaster-sync', async (job: Job) => {
  const handler = jobHandlers[job.name];
  
  if (!handler) {
    logger.warn({ jobName: job.name }, '[disaster-sync] Unknown job name');
    return;
  }

  try {
    await handler();
    logger.info({ jobName: job.name, jobId: job.id }, '[disaster-sync] Sync completed successfully');
  } catch (error) {
    logger.error({ jobName: job.name, jobId: job.id, err: error }, '[disaster-sync] Sync failed');
    throw error;
  }
}, {
  connection: connection as any,
  concurrency: getConcurrency(),
  stalledInterval: 300000,
});
