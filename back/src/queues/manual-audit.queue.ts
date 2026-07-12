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
    removeOnFail: { age: 24 * 3600, count: 100 },
  }
});

export async function addJobToManualAudit(data: any) {
  return manualAuditQueue.add('possible-duplicate', data);
}
