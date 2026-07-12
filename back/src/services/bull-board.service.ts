import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { iaProcessQueue } from '../queues/ia-process.queue';
import { disasterSyncQueue } from '../queues/disaster-sync.queue';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { personMatchingQueue } from '../queues/person-matching.queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

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

export const bullBoardRouter = serverAdapter.getRouter();
