import request from 'supertest';
import app from '../../src/app';
import { checkSyncState } from '../../src/services/sync-state.service';
import { addJobToIAQueue } from '../../src/queues/ia-process.queue';
import { PersonModel } from '../../src/models/unified-person.model';

// Mock auth middleware to bypass JWT in tests
jest.mock('../../src/middlewares/auth.middleware', () => {
  const actual = jest.requireActual('../../src/middlewares/auth.middleware');
  return {
    ...actual,
    requireUser: jest.fn((req: any, _res: any, next: any) => {
      req.user = { userId: 'test-user', role: 'user', tokenVersion: 0 };
      next();
    }),
    requireProfileComplete: jest.fn((req: any, _res: any, next: any) => {
      req.user = { userId: 'test-user', role: 'user', tokenVersion: 0, isProfileComplete: true };
      next();
    }),
  };
});

// Mock dependencies
jest.mock('../../src/services/sync-state.service', () => ({
  checkSyncState: jest.fn()
}));

jest.mock('../../src/queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

const mockPersons = [
  { name: 'Maria Rojas', status: 'missing', age: 30 }
];
const mockLean = jest.fn().mockResolvedValue(mockPersons);

jest.mock('../../src/models/unified-person.model', () => ({
  PersonModel: {
    find: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: (...args: any[]) => mockLean(...args),
    countDocuments: jest.fn().mockResolvedValue(1),
  }
}));

describe('Person API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Helper: fetch CSRF cookie + token for mutating requests */
  async function withCsrf(postRequest: request.Test): Promise<request.Test> {
    const csrfRes = await request(app).get('/api/auth/csrf-token');
    const cookies = Array.isArray(csrfRes.headers['set-cookie'])
      ? csrfRes.headers['set-cookie'] as string[]
      : [csrfRes.headers['set-cookie'] as string].filter(Boolean);
    const csrfCookie = cookies.find((c: string) => c.startsWith('csrf-token='));
    const csrfValue = csrfCookie?.split(';')[0] || '';
    return postRequest
      .set('Cookie', csrfValue)
      .set('x-csrf-token', csrfRes.body.token);
  }

  describe('GET /api/persons', () => {
    it('should return a list of persons securely without PII', async () => {
      const response = await request(app).get('/api/persons?q=maria&status=missing');
      
      expect(response.status).toBe(200);
      expect(response.body.persons).toHaveLength(1);
      expect(response.body.persons[0].name).toBe('Maria Rojas');
      expect(PersonModel.find).toHaveBeenCalledWith({ 
        normalizedName: { $regex: 'maria', $options: 'i' },
        status: 'missing'
      });
      expect(PersonModel.find().select).toHaveBeenCalledWith(expect.objectContaining({
        name: 1,
        'metadata.urgencyScore': 1
      }));
    });
  });

  describe('POST /api/persons', () => {
    it('should return 400 for invalid payload', async () => {
      const response = await withCsrf(
        request(app)
          .post('/api/persons')
          .send({ name: 'Short' }) // missing required fields
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 200 skipped if deduplication middleware says no_changes', async () => {
      (checkSyncState as jest.Mock).mockResolvedValue({ status: 'skipped', reason: 'no_changes' });

      const response = await withCsrf(
        request(app)
          .post('/api/persons')
          .send({
            source: 'telegram',
            externalId: '123',
            name: 'Maria Rojas',
            estado: 'Zulia'
          })
      );

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

      const response = await withCsrf(
        request(app)
          .post('/api/persons')
          .send(payload)
      );

      expect(response.status).toBe(202);
      expect(response.body.status).toBe('queued');
      
      expect(addJobToIAQueue).toHaveBeenCalledTimes(1);
      
      const calledPayload = (addJobToIAQueue as jest.Mock).mock.calls[0][0];
      expect(calledPayload.name).toBe('Maria Rojas');
      expect(calledPayload.source).toBe('telegram');
    });
  });
});
