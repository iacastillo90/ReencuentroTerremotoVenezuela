import { PersonMatchingQueue } from '../queues/person-matching.queue';
import { personMatchingWorker } from '../workers/matching.worker';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    name: 'person-matching',
    add: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    name: 'person-matching',
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../config/redis.config', () => ({
  connection: {},
}));

jest.mock('../services/matcher.service', () => ({
  runMatchingForNewPerson: jest.fn().mockResolvedValue(undefined),
}));

describe('PersonMatchingQueue', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates queue with name person-matching', () => {
    const queue = new PersonMatchingQueue();
    expect(queue.name).toBe('person-matching');
  });

  it('configures queue with retry options', () => {
    const { Queue } = require('bullmq');
    new PersonMatchingQueue();
    expect(Queue).toHaveBeenCalledWith(
      'person-matching',
      expect.objectContaining({
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      })
    );
  });

  it('enqueues a matching job with correct data', async () => {
    const queue = new PersonMatchingQueue();
    const { Queue } = require('bullmq');
    const queueInstance = (Queue as jest.Mock).mock.results[0].value;

    await queue.enqueue({ idHash: 'abc123', source: 'test' });

    expect(queueInstance.add).toHaveBeenCalledWith(
      'match-person',
      { idHash: 'abc123', source: 'test' },
      undefined
    );
  });

  it('worker is defined', () => {
    expect(personMatchingWorker).toBeDefined();
    expect(personMatchingWorker).toBeInstanceOf(Object);
  });
});
