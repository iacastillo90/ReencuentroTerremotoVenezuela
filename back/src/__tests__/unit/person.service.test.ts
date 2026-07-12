jest.mock('ioredis', () => {
  const MockRedis = {
    status: 'ready',
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    isCluster: false,
    options: {},
  };
  return { __esModule: true, default: jest.fn(() => MockRedis), Redis: jest.fn(() => MockRedis) };
});

jest.mock('../../models/unified-person.model', () => ({
  PersonModel: {
    findOneAndUpdate: jest.fn()
  }
}));

jest.mock('../../queues/ia-process.queue', () => ({ addJobToIAQueue: jest.fn() }));
jest.mock('../../queues/manual-audit.queue', () => ({ addJobToManualAudit: jest.fn() }));
jest.mock('../../queues/person-matching.queue', () => ({ personMatchingQueue: { enqueue: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../services/outbox.service', () => ({ addToOutbox: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/sync-state.service', () => ({ checkSyncState: jest.fn() }));
jest.mock('../../models/audit-log.model', () => ({ AuditLogModel: { create: jest.fn() } }));
jest.mock('../../utils/person-view.util', () => ({ toPublicPerson: jest.fn(p => p) }));

import { upsertPerson } from '../../services/person.service';
import { PersonModel } from '../../models/unified-person.model';

describe('person.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call findOneAndUpdate with correct arguments for a new person', async () => {
    const mockDate = new Date('2026-06-01');
    jest.useFakeTimers().setSystemTime(mockDate);
    
    const mockResult = {
      _id: 'mock-id',
      idHash: 'some-hash',
      externalIds: [{ source: 'whatsapp', id: 'msg-123' }],
      metadata: { lastSync: mockDate }
    };

    (PersonModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockResult);

    const person = await upsertPerson('whatsapp', 'msg-123', {
      type: 'person',
      name: 'Juan Perez',
      normalizedName: 'juan perez',
      lastSeen: {
        description: 'En el centro',
        state: 'Miranda',
        date: mockDate
      }
    });

    expect(PersonModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const callArgs = (PersonModel.findOneAndUpdate as jest.Mock).mock.calls[0];
    
    expect(callArgs[0]).toHaveProperty('idHash');
    expect(callArgs[1].$set).toHaveProperty('name', 'Juan Perez');
    expect(callArgs[1].$set['metadata.lastSync']).toEqual(mockDate);
    expect(callArgs[1].$addToSet.externalIds.source).toBe('whatsapp');
    expect(callArgs[1].$addToSet.externalIds.id).toBe('msg-123');

    expect(person).toEqual(mockResult);

    jest.useRealTimers();
  });
});
