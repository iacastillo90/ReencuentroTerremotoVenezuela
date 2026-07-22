/**
 * queues/manual-audit.queue — Cola de auditoría manual
 *
 * PROPÓSITO:
 *   Define la cola BullMQ para trabajos de auditoría manual que requieren
 *   revisión humana, como posibles duplicados detectados por fuzzy matching.
 *
 * CARACTERÍSTICAS:
 *   - Backoff exponencial (5 reintentos)
 *   - Función helper addJobToManualAudit para encolar trabajos
 *
 * @module manual-audit.queue
 */

import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export const MANUAL_AUDIT_QUEUE_NAME = 'manual-audit';

export const manualAuditQueue = new Queue(MANUAL_AUDIT_QUEUE_NAME, {
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

export async function addJobToManualAudit(data: any) {
  return manualAuditQueue.add('possible-duplicate', data);
}
