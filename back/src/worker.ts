import './sentry';
import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from './database/connection';
import { logger } from './utils/logger.util';
import { connection as redis } from './config/redis.config';

async function bootstrapWorker() {
  try {
    await connectDB('Worker');

    logger.info('[Worker] Starting BullMQ workers...');
    const { disasterSyncWorker } = require('./workers/disaster-sync.worker');
    const { iaProcessorWorker } = require('./workers/ia-processor.worker');
    const { personMatchingWorker } = require('./workers/matching.worker');

    const workers = [disasterSyncWorker, iaProcessorWorker, personMatchingWorker].filter(Boolean);

    logger.info('[Worker] All workers listening for tasks.');

    function shutdown(signal: string) {
      logger.info({ signal }, `Received signal — starting graceful shutdown for standalone worker`);
      
      Promise.all(workers.map(w => w.close().catch((err: any) => logger.warn({ err }, 'Error closing worker'))))
        .then(async () => {
          logger.info('[Worker] All BullMQ workers closed gracefully');
          await mongoose.disconnect();
          logger.info('[Worker] MongoDB disconnected');
          redis.disconnect();
          logger.info('[Worker] Redis disconnected');
          process.exit(0);
        })
        .catch(() => process.exit(1));

      setTimeout(() => {
        logger.error('[Worker] Forced shutdown by timeout');
        process.exit(1);
      }, 15000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, '[Worker] Critical startup error');
    process.exit(1);
  }
}

bootstrapWorker();
