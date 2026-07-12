import './sentry';
import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from './database/connection';
import { logger } from './utils/logger.util';

async function bootstrapWorker() {
  try {
    await connectDB('Worker');

    logger.info('[Worker] Starting BullMQ workers...');
    require('./workers/disaster-sync.worker');
    require('./workers/ia-processor.worker');
    require('./workers/matching.worker');

    logger.info('[Worker] All workers listening for tasks.');
  } catch (error) {
    logger.error({ err: error }, '[Worker] Critical startup error');
    process.exit(1);
  }
}

bootstrapWorker();
