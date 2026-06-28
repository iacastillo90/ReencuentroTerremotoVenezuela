import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export const MANUAL_AUDIT_QUEUE_NAME = 'manual-audit';

export const manualAuditQueue = new Queue(MANUAL_AUDIT_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});

export async function addJobToManualAudit(data: any) {
  return manualAuditQueue.add('possible-duplicate', data);
}
