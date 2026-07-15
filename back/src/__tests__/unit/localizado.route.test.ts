import request from 'supertest';
import app from '../../app';

jest.mock('../../models/localizado.model', () => ({
  LocalizadoModel: {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
  }
}));

jest.mock('../../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../../queues/manual-audit.queue', () => ({
  manualAuditQueue: { getWaiting: jest.fn(), getJob: jest.fn() },
  addJobToManualAudit: jest.fn()
}));

jest.mock('../../config/redis.config', () => ({
  connection: {}
}));

jest.mock('../../services/storage.service', () => ({
  uploadMedia: jest.fn(),
  getPresignedUrl: jest.fn(),
  getPresignedUploadUrl: jest.fn(),
  initializeStorage: jest.fn(),
  minioClient: {},
}));

jest.mock('../../middlewares/auth.middleware', () => ({
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
  requirePartnerApiKey: jest.fn((_req: any, _res: any, next: any) => next()),
  getJwtSecret: jest.fn(() => 'test-secret'),
}));

describe('Localizado Route Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query length validation', () => {
    it('should return 400 when query exceeds 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const response = await request(app).get(`/api/localizados?q=${longQuery}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('demasiado larga');
    });

    it('should return 200 with a valid short query', async () => {
      const { LocalizadoModel } = require('../../models/localizado.model');
      (LocalizadoModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { name: 'Juan Perez', location: 'Hospital General', cedula: 'V-12345678' }
        ])
      });
      (LocalizadoModel.countDocuments as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/localizados?q=juan');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
