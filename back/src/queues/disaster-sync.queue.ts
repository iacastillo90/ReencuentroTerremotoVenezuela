import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export const DISASTER_SYNC_QUEUE_NAME = 'disaster-sync';

export const disasterSyncQueue = new Queue(DISASTER_SYNC_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});

// Registrar los jobs repetitivos (Cron)
export async function setupDisasterSyncJobs() {
  // Remover jobs anteriores para evitar duplicados en desarrollo
  const repeatableJobs = await disasterSyncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await disasterSyncQueue.removeRepeatableByKey(job.key);
  }

  // USGS cada 5 minutos
  await disasterSyncQueue.add('sync-usgs', {}, {
    repeat: { pattern: '*/5 * * * *' }
  });

  // FIRMS cada 3 horas
  await disasterSyncQueue.add('sync-firms', {}, {
    repeat: { pattern: '0 */3 * * *' }
  });

  // GDACS cada 1 hora
  await disasterSyncQueue.add('sync-gdacs', {}, {
    repeat: { pattern: '0 * * * *' }
  });

  // Reencuentro API cada 10 minutos
  await disasterSyncQueue.add('sync-reencuentro', {}, {
    repeat: { pattern: '*/10 * * * *' }
  });

  // VenezuelaReporta API cada 10 minutos
  await disasterSyncQueue.add('sync-venezuelareporta', {}, {
    repeat: { pattern: '*/10 * * * *' }
  });
  
  // FUNVISIS Sismos cada 5 minutos
  await disasterSyncQueue.add('sync-funvisis', {}, {
    repeat: { pattern: '*/5 * * * *' }
  });

  // INAMEH Lluvias cada 15 minutos
  await disasterSyncQueue.add('sync-inameh', {}, {
    repeat: { pattern: '*/15 * * * *' }
  });

  // CORPOELEC Electricidad cada 15 minutos
  await disasterSyncQueue.add('sync-corpoelec', {}, {
    repeat: { pattern: '*/15 * * * *' }
  });

  // PROTECCIÓN CIVIL cada 20 minutos
  await disasterSyncQueue.add('sync-proteccion-civil', {}, {
    repeat: { pattern: '*/20 * * * *' }
  });

  // CRUZ ROJA cada 20 minutos
  await disasterSyncQueue.add('sync-cruz-roja', {}, {
    repeat: { pattern: '*/20 * * * *' }
  });

  console.log('[DisasterSync] Cron jobs registered.');
}
