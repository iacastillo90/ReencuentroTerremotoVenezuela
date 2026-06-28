import { checkSyncState, markSyncSuccess, markSyncError, generateChecksum } from '../../src/services/sync-state.service';
import { SyncStateModel } from '../../src/models/sync-state.model';

jest.mock('../../src/models/sync-state.model', () => ({
  SyncStateModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}));

describe('sync-state.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChecksum', () => {
    it('should generate same checksum for same object with different key order', () => {
      const obj1 = { name: 'Juan', age: 30 };
      const obj2 = { age: 30, name: 'Juan' };
      
      expect(generateChecksum(obj1)).toEqual(generateChecksum(obj2));
    });
  });

  describe('checkSyncState', () => {
    it('should return process for new record', async () => {
      (SyncStateModel.findOne as jest.Mock).mockResolvedValue(null);
      
      const payload = { data: 'test' };
      const result = await checkSyncState('web', '123', payload);
      
      expect(result.status).toBe('process');
      if (result.status === 'process') {
        expect(result.checksum).toBeDefined();
      }
    });

    it('should return skipped if checksum is same and date is older', async () => {
      const payload = { data: 'test' };
      const checksum = generateChecksum(payload);
      const pastDate = new Date('2026-06-01');
      const olderUpdateDate = new Date('2026-05-01');

      (SyncStateModel.findOne as jest.Mock).mockResolvedValue({
        checksum,
        lastProcessed: pastDate
      });
      
      const result = await checkSyncState('web', '123', payload, olderUpdateDate);
      
      expect(result.status).toBe('skipped');
    });

    it('should return process if checksum changed', async () => {
      const payload = { data: 'changed' };
      const pastDate = new Date('2026-06-01');
      
      (SyncStateModel.findOne as jest.Mock).mockResolvedValue({
        checksum: 'old_checksum',
        lastProcessed: pastDate
      });
      
      const result = await checkSyncState('web', '123', payload);
      
      expect(result.status).toBe('process');
    });

    it('should return process if payload date is newer', async () => {
      const payload = { data: 'test' };
      const checksum = generateChecksum(payload);
      
      // DB says it was processed on June 1st
      (SyncStateModel.findOne as jest.Mock).mockResolvedValue({
        checksum,
        lastProcessed: new Date('2026-06-01')
      });
      
      // But the incoming payload has an update date of June 10th
      const result = await checkSyncState('web', '123', payload, new Date('2026-06-10'));
      
      expect(result.status).toBe('process');
    });
  });

  describe('markSyncSuccess and markSyncError', () => {
    it('should mark success with upsert and inc processCount', async () => {
      await markSyncSuccess('web', '123', 'new-hash');
      
      expect(SyncStateModel.findOneAndUpdate).toHaveBeenCalledWith(
        { source: 'web', externalId: '123' },
        expect.objectContaining({
          $set: expect.objectContaining({ checksum: 'new-hash' }),
          $inc: { processCount: 1 },
          $unset: { lastError: "" }
        }),
        { upsert: true }
      );
    });

    it('should mark error and save errorMessage', async () => {
      await markSyncError('web', '123', 'Network failure');
      
      expect(SyncStateModel.findOneAndUpdate).toHaveBeenCalledWith(
        { source: 'web', externalId: '123' },
        expect.objectContaining({
          $set: { lastError: 'Network failure' },
          $inc: { processCount: 1 }
        }),
        { upsert: true }
      );
    });
  });
});
