import { Job } from 'bullmq';
import { processAndReconcilePerson } from '../services/reconciliation.service';

import { iaProcessorWorker } from './ia-processor.worker';

jest.mock('../services/reconciliation.service', () => ({
  processAndReconcilePerson: jest.fn()
}));

jest.mock('../config/redis.config', () => ({
  connection: {} // mock redis connection
}));

jest.mock('../services/ai/ai.factory', () => ({
  getAIProvider: jest.fn().mockReturnValue({
    processRecord: jest.fn().mockResolvedValue({
      name: 'Maria Rojas',
      estado: 'Zulia',
      safeDescription: 'Mocked safe description',
      medicalStatus: 'estable',
      urgencyScore: 75
    })
  })
}));

describe('ia-processor.worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call processAndReconcilePerson with AI extracted data', async () => {
    const mockJob = {
      id: 'job-123',
      data: {
        source: 'telegram',
        externalId: 'msg-555',
        type: 'person',
        text: 'Mi nombre es Maria Rojas y estoy perdida en Zulia',
        date: '2026-06-05T12:00:00.000Z',
      }
    } as unknown as Job;

    (processAndReconcilePerson as jest.Mock).mockResolvedValue({ status: 'inserted', idHash: 'test-hash' });

    const processor = (iaProcessorWorker as any).processFn;

    if (processor) {
      await processor(mockJob);
    }

    expect(processAndReconcilePerson).toHaveBeenCalledTimes(1);
    const args = (processAndReconcilePerson as jest.Mock).mock.calls[0];
    
    expect(args[0]).toBe('telegram'); // source
    expect(args[1]).toBe('msg-555'); // externalId
    
    const personData = args[2];
    expect(personData.name).toBe('Maria Rojas');
    expect(personData.normalizedName).toBe('maria rojas');
    expect(personData.lastSeen.state).toBe('Zulia');
    expect(personData.metadata.aiProcessed).toBe(true);
    expect(personData.metadata.urgencyScore).toBe(75);
  });
});

