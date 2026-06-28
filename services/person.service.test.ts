import { upsertPerson } from './person.service';
import { PersonModel } from '../models/unified-person.model';

jest.mock('../models/unified-person.model', () => ({
  PersonModel: {
    findOneAndUpdate: jest.fn()
  }
}));

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
    
    // Check idHash
    expect(callArgs[0]).toHaveProperty('idHash');
    
    // Check $set
    expect(callArgs[1].$set).toHaveProperty('name', 'Juan Perez');
    expect(callArgs[1].$set['metadata.lastSync']).toEqual(mockDate);
    
    // Check $addToSet
    expect(callArgs[1].$addToSet.externalIds.source).toBe('whatsapp');
    expect(callArgs[1].$addToSet.externalIds.id).toBe('msg-123');

    expect(person).toEqual(mockResult);

    jest.useRealTimers();
  });
});
