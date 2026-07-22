/**
 * queues/ia-process.queue — Cola de procesamiento con IA
 *
 * PROPÓSITO:
 *   Define la cola BullMQ para el procesamiento asíncrono de reportes
 *   de texto libre mediante proveedores de IA (Anthropic, OpenAI, Gemini).
 *
 * CARACTERÍSTICAS:
 *   - Backoff exponencial (5 reintentos)
 *   - Función helper addJobToIAQueue para encolar trabajos
 *
 * @module ia-process.queue
 */

import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export const IA_PROCESS_QUEUE_NAME = 'ia-process';

export const iaProcessQueue = new Queue(IA_PROCESS_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  }
});

export async function addJobToIAQueue(data: any) {
  return iaProcessQueue.add('process-record', data);
}
