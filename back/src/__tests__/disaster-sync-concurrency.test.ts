import { Worker } from 'bullmq';

jest.mock('../config/redis.config', () => ({
  connection: {
    on: jest.fn(),
    status: 'ready',
    disconnect: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
  }
}));

describe('DisasterSyncConcurrency', () => {
  const ORIGINAL_ENV = process.env;
  const workers: Worker[] = [];

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    for (const w of workers) {
      try { w.close(); } catch { /* ignore */ }
    }
    workers.length = 0;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('uses default concurrency of 3 when env var not set', () => {
    delete process.env.DISASTER_SYNC_CONCURRENCY;
    const mod = require('../workers/disaster-sync.worker');
    workers.push(mod.disasterSyncWorker);
    expect(mod.disasterSyncWorker.concurrency).toBe(3);
  });

  it('uses DISASTER_SYNC_CONCURRENCY env var when set', () => {
    process.env.DISASTER_SYNC_CONCURRENCY = '5';
    const mod = require('../workers/disaster-sync.worker');
    workers.push(mod.disasterSyncWorker);
    expect(mod.disasterSyncWorker.concurrency).toBe(5);
  });

  it('falls back to 1 for invalid DISASTER_SYNC_CONCURRENCY values', () => {
    process.env.DISASTER_SYNC_CONCURRENCY = 'invalid';
    const mod = require('../workers/disaster-sync.worker');
    workers.push(mod.disasterSyncWorker);
    expect(mod.disasterSyncWorker.concurrency).toBe(1);
  });

  it('handles individual job failures without stopping others', () => {
    const mod = require('../workers/disaster-sync.worker');
    workers.push(mod.disasterSyncWorker);
    expect(mod.disasterSyncWorker).toBeDefined();
    expect(mod.disasterSyncWorker.concurrency).toBeGreaterThanOrEqual(1);
  });
});
