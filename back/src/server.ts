/**
 * server.ts — Entry point del backend
 *
 * PROPÓSITO:
 *   Bootstrap de la aplicación: inicializa MongoDB, Redis, colas BullMQ,
 *   workers de procesamiento, outbox pattern, Socket.IO, y levanta el
 *   servidor HTTP. Maneja graceful shutdown.
 *
 * FLUJO DE INICIALIZACIÓN:
 *   1. Valida JWT_SECRET (requerido en producción)
 *   2. Conecta a MongoDB con retry
 *   3. Inicia workers (ia-processor, disaster-sync, matching) si está en monolith mode
 *   4. Registra handler de unhandledRejection (fatal log + exit)
 *   5. Inicia procesador de outbox
 *   6. Crea servidor HTTP + Socket.IO
 *   7. Escucha en PORT
 *   8. Inicializa storage (S3/MinIO)
 *   9. Setup de jobs programados (disaster sync)
 *   10. Graceful shutdown handlers (SIGTERM, SIGINT)
 *
 * MODO DE OPERACIÓN:
 *   - Monolith mode: RUN_WORKERS_IN_API=true o NODE_ENV=development
 *     → Workers corren dentro del mismo proceso
 *   - Microservices mode: NODE_ENV=production + RUN_WORKERS_IN_API=false
 *     → Workers en containers separados
 *
 * SEGURIDAD:
 *   - unhandledRejection handler: previene crashes silenciosos
 *   - Graceful shutdown: cierra conexiones limpiamente
 *   - Validación de env vars en startup: fail fast
 *
 * DEPENDENCIAS CRÍTICAS:
 *   - MongoDB: Required (sin él no hay BD)
 *   - Redis: Required (cache, colas, sockets)
 *   - Storage: Optional (uploads de archivos)
 *   - Workers: Optional (según modo de deploy)
 *
 * GRACEFUL SHUTDOWN:
 *   1. Detiene servidor HTTP (deja de aceptar conexiones)
 *   2. Cierra Socket.IO clients
 *   3. Detiene procesador de outbox
 *   4. Cierra workers de BullMQ
 *   5. Cierra conexión a MongoDB
 *   6. Cierra conexión a Redis
 *   7. Proceso exit(0)
 */
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

    if (process.env.RUN_WORKERS_IN_API !== 'false') {
      logger.info('Starting internal workers (monolith mode)');
      const { iaProcessorWorker } = require('./workers/ia-processor.worker');
      const { disasterSyncWorker } = require('./workers/disaster-sync.worker');
      const { personMatchingWorker } = require('./workers/matching.worker');
      workers = [iaProcessorWorker, disasterSyncWorker, personMatchingWorker].filter(Boolean);
    } else {
      logger.info('Internal workers disabled (assuming dedicated containers)');
    }

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ err: reason }, 'Unhandled Rejection');
      process.exit(1);
    });

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
