import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export class PersonMatchingQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('person-matching', {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }

  get name(): string {
    return this.queue.name;
  }

  get underlyingQueue(): Queue {
    return this.queue;
  }

  async enqueue(data: { idHash: string; source: string }, opts?: { delay?: number }): Promise<void> {
    await this.queue.add('match-person', data, opts);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export const personMatchingQueue = new PersonMatchingQueue();
