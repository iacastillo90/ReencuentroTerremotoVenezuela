import request from 'supertest';
import app from '../app';
import { checkSyncState } from '../services/sync-state.service';
import { addJobToIAQueue } from '../queues/ia-process.queue';

// Mock dependencies
jest.mock('../services/sync-state.service', () => ({
  checkSyncState: jest.fn()
}));

jest.mock('../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

describe('POST /api/persons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/api/persons')
      .send({ name: 'Short' }); // missing required fields

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Validation Error');
  });

  it('should return 200 skipped if deduplication middleware says no_changes', async () => {
    (checkSyncState as jest.Mock).mockResolvedValue({ status: 'skipped', reason: 'no_changes' });

    const response = await request(app)
      .post('/api/persons')
      .send({
        source: 'telegram',
        externalId: '123',
        name: 'Maria Rojas',
        estado: 'Zulia'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('skipped');
    expect(addJobToIAQueue).not.toHaveBeenCalled();
  });

  it('should return 202 queued if data is new or changed', async () => {
    (checkSyncState as jest.Mock).mockResolvedValue({ status: 'process', checksum: 'hash123' });

    const payload = {
      source: 'telegram',
      externalId: '123',
      name: 'Maria Rojas',
      estado: 'Zulia',
      data: { age: 30 }
    };

    const response = await request(app)
      .post('/api/persons')
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body.status).toBe('queued');
    
    expect(addJobToIAQueue).toHaveBeenCalledTimes(1);
    
    const calledPayload = (addJobToIAQueue as jest.Mock).mock.calls[0][0];
    expect(calledPayload.name).toBe('Maria Rojas');
    expect(calledPayload.source).toBe('telegram');
  });
});
