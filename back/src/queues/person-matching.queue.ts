/**
 * queues/person-matching.queue — Cola de matching de personas
 *
 * PROPÓSITO:
 *   Define la cola y clase para el matching asíncrono de personas,
 *   comparando nuevos reportes contra la base de datos existente
 *   para encontrar coincidencias potenciales.
 *
 * CARACTERÍSTICAS:
 *   - Clase PersonMatchingQueue con interfaz enqueue/close
 *   - Instancia singleton personMatchingQueue exportada
 *   - Backoff exponencial (5 reintentos)
 *
 * @module person-matching.queue
 */

import { Queue } from 'bullmq';
import { connection } from '../config/redis.config';

export class PersonMatchingQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('person-matching', {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: true,
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
