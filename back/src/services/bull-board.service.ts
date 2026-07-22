/**
 * services/bull-board.service — Panel de monitoreo de colas BullMQ
 *
 * PROPÓSITO:
 *   Configura y exporta el router de Bull Board, una interfaz web
 *   para monitorear y gestionar todas las colas BullMQ del sistema.
 *
 * CARACTERÍSTICAS:
 *   - Integra todas las colas: iaProcess, disasterSync, manualAudit, personMatching
 *   - Montado en /api/admin/queues (protegido con api key de admin)
 *   - ExpressAdapter con basePath configurado
 *
 * @module bull-board.service
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { iaProcessQueue } from '../queues/ia-process.queue';
import { disasterSyncQueue } from '../queues/disaster-sync.queue';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { personMatchingQueue } from '../queues/person-matching.queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

if (process.env.NODE_ENV !== 'test') {
  try {
    createBullBoard({
      queues: [
        new BullMQAdapter(iaProcessQueue),
        new BullMQAdapter(disasterSyncQueue),
        new BullMQAdapter(manualAuditQueue),
        new BullMQAdapter(personMatchingQueue.underlyingQueue),
      ],
      serverAdapter,
      options: {
        uiConfig: {
          boardTitle: 'Reencuentros — Colas',
        },
      },
    });
  } catch (err) {
    // Graceful fallback for test or uninitialized Redis environments
  }
}

export const bullBoardRouter = serverAdapter.getRouter();
