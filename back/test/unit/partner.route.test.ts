import request from 'supertest';
import app from '../../src/app';

const PARTNER_API_KEY = 'test-partner-key';

jest.mock('../../src/middlewares/auth.middleware', () => ({
  requireUser: jest.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'user', tokenVersion: 0 };
    next();
  }),
  requireProfileComplete: jest.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', role: 'user', tokenVersion: 0, isProfileComplete: true };
    next();
  }),
  requireAdminApiKey: jest.fn((_req: any, _res: any, next: any) => next()),
  requireWebhookApiKey: jest.fn((_req: any, _res: any, next: any) => next()),
  requirePartnerApiKey: jest.fn((req: any, _res: any, next: any) => next()),
  getJwtSecret: jest.fn(() => 'test-secret'),
}));

jest.mock('../../src/queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../../src/queues/manual-audit.queue', () => ({
  manualAuditQueue: { getWaiting: jest.fn(), getJob: jest.fn() },
  addJobToManualAudit: jest.fn()
}));

jest.mock('../../src/config/redis.config', () => ({
  connection: {
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }
}));

jest.mock('../../src/models/unified-person.model', () => {
  const mockSave = jest.fn().mockResolvedValue({ _id: 'mock-id-123' });
  const MockPersonModel = jest.fn().mockImplementation(() => ({
    save: mockSave,
    _id: 'mock-id-123',
  })) as any;
  MockPersonModel.find = jest.fn().mockReturnThis();
  MockPersonModel.sort = jest.fn().mockReturnThis();
  MockPersonModel.skip = jest.fn().mockReturnThis();
  MockPersonModel.limit = jest.fn().mockReturnThis();
  MockPersonModel.lean = jest.fn().mockResolvedValue([]);
  MockPersonModel.countDocuments = jest.fn().mockResolvedValue(0);
  return { PersonModel: MockPersonModel };
});

jest.mock('../../src/services/storage.service', () => ({
  uploadMedia: jest.fn(),
  getPresignedUrl: jest.fn(),
  getPresignedUploadUrl: jest.fn(),
  initializeStorage: jest.fn(),
  minioClient: {},
}));

describe('Partner Route Security', () => {
  beforeAll(() => {
    process.env.PARTNER_API_KEY = PARTNER_API_KEY;
  });

  afterAll(() => {
    delete process.env.PARTNER_API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Field whitelist', () => {
    it('should strip extra fields not defined in the schema', async () => {
      const { PersonModel } = require('../../src/models/unified-person.model');

      const response = await request(app)
        .post('/api/partners/cases')
        .set('x-partner-api-key', PARTNER_API_KEY)
        .send({
          cases: [{
            name: 'Test Person',
            status: 'missing',
            admin: true,
            maliciousField: 'x',
          }]
        });

      expect(response.status).toBe(201);

      const constructorCall = (PersonModel as jest.Mock).mock.calls[0];
      const passedData = constructorCall[0];

      expect(passedData).toHaveProperty('name', 'Test Person');
      expect(passedData).toHaveProperty('status', 'missing');
      expect(passedData).not.toHaveProperty('admin');
      expect(passedData).not.toHaveProperty('maliciousField');
    });
  });

  describe('Required fields', () => {
    it('should return 400 when cases array is empty', async () => {
      const response = await request(app)
        .post('/api/partners/cases')
        .set('x-partner-api-key', PARTNER_API_KEY)
        .send({ cases: [] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/partners/cases')
        .set('x-partner-api-key', PARTNER_API_KEY)
        .send({
          cases: [{ status: 'missing' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });
});
