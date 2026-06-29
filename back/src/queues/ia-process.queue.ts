import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export const IA_PROCESS_QUEUE_NAME = 'ia-process';

export const iaProcessQueue = new Queue(IA_PROCESS_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: { age: 24 * 3600, count: 100 },
  }
});

export async function addJobToIAQueue(data: any) {
  return iaProcessQueue.add('process-record', data);
}
