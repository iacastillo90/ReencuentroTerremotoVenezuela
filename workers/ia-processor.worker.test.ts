import { Job } from 'bullmq';
import { upsertPerson } from '../services/person.service';

// Mock the worker since we only want to test its logic, not BullMQ internals directly
// We'll extract the processor function from the worker to test it
import { iaProcessorWorker } from './ia-processor.worker';

jest.mock('../services/person.service', () => ({
  upsertPerson: jest.fn()
}));
jest.mock('../config/redis.config', () => ({
  connection: {} // mock redis connection
}));

describe('ia-processor.worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call upsertPerson with processed data', async () => {
    const mockJob = {
      id: 'job-123',
      data: {
        source: 'telegram',
        externalId: 'msg-555',
        type: 'person',
        name: 'Maria Rojas',
        estado: 'Zulia',
        date: '2026-06-05T12:00:00.000Z',
        data: { age: '45' }
      }
    } as unknown as Job;

    (upsertPerson as jest.Mock).mockResolvedValue({ idHash: 'test-hash' });

    // The processor is available on the worker instance
    // We cast to any to access the protected processFn or we just use the options
    const processor = (iaProcessorWorker as any).processFn;

    if (processor) {
      await processor(mockJob);
    }

    expect(upsertPerson).toHaveBeenCalledTimes(1);
    const args = (upsertPerson as jest.Mock).mock.calls[0];
    
    expect(args[0]).toBe('telegram'); // source
    expect(args[1]).toBe('msg-555'); // externalId
    
    const personData = args[2];
    expect(personData.name).toBe('Maria Rojas');
    expect(personData.normalizedName).toBe('maria rojas');
    expect(personData.lastSeen.state).toBe('Zulia');
    expect(personData.age).toBe(45);
    expect(personData.metadata.aiProcessed).toBe(true);
    expect(personData.metadata.urgencyScore).toBe(75);
  });
});
