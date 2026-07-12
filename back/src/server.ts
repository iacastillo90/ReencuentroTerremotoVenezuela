import './sentry';
import 'dotenv/config';
import mongoose from 'mongoose'; // Necesario para el graceful shutdown
import http from 'http';
import app from './app';
import { setupDisasterSyncJobs } from './queues/disaster-sync.queue';
import { initializeStorage } from './services/storage.service';
import { initializeSocketServer } from './services/socket.service';
import { startOutboxProcessor, stopOutboxProcessor } from './services/outbox.service';
import { connection as redis } from './config/redis.config';
import { logger } from './utils/logger.util';
import { connectDB } from './database/connection';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      logger.fatal('JWT_SECRET is required in production');
      process.exit(1);
    }

    await connectDB('Server');

    let workers: any[] = [];

    if (process.env.NODE_ENV !== 'production' || process.env.RUN_WORKERS_IN_API === 'true') {
      logger.info('Starting internal workers (monolith mode)');
      const { iaProcessorWorker } = require('./workers/ia-processor.worker');
      const { disasterSyncWorker } = require('./workers/disaster-sync.worker');
      const { personMatchingWorker } = require('./workers/matching.worker');
      workers = [iaProcessorWorker, disasterSyncWorker, personMatchingWorker].filter(Boolean);
    } else {
      logger.info('Internal workers disabled (assuming dedicated containers)');
    }

    startOutboxProcessor();

    const server = http.createServer(app);

    const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000')
      .split(',')
      .map(s => s.trim().replace(/\/$/, ''));

    initializeSocketServer(server, corsOrigins);
    logger.info('Socket.IO server initialized');

    server.listen(PORT, () => {
      logger.info({ port: PORT }, `Backend running on http://localhost:${PORT}`);

      initializeStorage()
        .then(() => logger.info('Storage initialized'))
        .catch((err) => logger.error({ err }, 'Error initializing storage'));

      setupDisasterSyncJobs()
        .then(() => logger.info('Sync jobs registered (background)'))
        .catch((err) => logger.error({ err }, 'Error registering sync jobs'));
    });

    function shutdown(signal: string) {
      logger.info({ signal }, `Received signal — starting graceful shutdown`);
      server.close(async () => {
        logger.info('HTTP server closed');
        stopOutboxProcessor();

        for (const worker of workers) {
          try {
            await worker.close();
            logger.info('Worker closed');
          } catch (err) {
            logger.warn({ err }, 'Error closing worker');
          }
        }

        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
        redis.disconnect();
        logger.info('Redis disconnected');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown by timeout');
        process.exit(1);
      }, 10000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Critical error during startup');
    process.exit(1);
  }
}

bootstrap();
