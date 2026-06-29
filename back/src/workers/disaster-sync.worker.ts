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
  } else if (job.name === 'sync-reencuentro') {
    console.log(`[Worker] Starting Reencuentro Sync Job ${job.id}`);
    await fetchReencuentroPersons();
  } else if (job.name === 'sync-venezuelareporta') {
    console.log(`[Worker] Starting VenezuelaReporta Sync Job ${job.id}`);
    await fetchVenezuelaReporta();
  } else if (job.name === 'sync-funvisis') {
    console.log(`[Worker] Starting FUNVISIS Sync Job ${job.id}`);
    await runFunvisisJob();
  } else if (job.name === 'sync-inameh') {
    console.log(`[Worker] Starting INAMEH Sync Job ${job.id}`);
    await runInamehJob();
  } else if (job.name === 'sync-corpoelec') {
    console.log(`[Worker] Starting CORPOELEC Sync Job ${job.id}`);
    await runCorpoelecJob();
  } else if (job.name === 'sync-proteccion-civil') {
    console.log(`[Worker] Starting PROTECCION CIVIL Sync Job ${job.id}`);
    await runProteccionCivilJob();
  } else if (job.name === 'sync-cruz-roja') {
    console.log(`[Worker] Starting CRUZ ROJA Sync Job ${job.id}`);
    await runCruzRojaJob();
  }
}, { connection: connection as any });
