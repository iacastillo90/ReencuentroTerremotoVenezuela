process.env.JWT_SECRET = 'test-secret';
process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';

import request from 'supertest';
import app from '../../app';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockRejectedValue(new Error('Mocked Google auth failure'))
  }))
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

jest.mock('../../middlewares/audit.middleware', () => ({
  auditLog: jest.fn()
}));

jest.mock('../../models/user.model', () => ({
  UserModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
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

describe('Auth Route Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DEV_MODE guard', () => {
    it('should return 403 when DEV_MODE attempted in production', async () => {
      const origEnv = { ...process.env };
      process.env.NODE_ENV = 'production';
      process.env.DEV_MODE = 'true';

      const response = await request(app)
        .post('/api/auth/google')
        .send({ token: 'fake-google-token' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('DEV_MODE disabled in production');

      const auditLog = require('../../middlewares/audit.middleware').auditLog;
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'security_violation',
          severity: 'critical',
        })
      );

      process.env = origEnv;
    });
  });

  describe('CSRF cookie', () => {
    it('should return csrf-token cookie with httpOnly and secure flags', async () => {
      const response = await request(app).get('/api/auth/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');

      const setCookie = response.headers['set-cookie'];
      const csrfCookie = Array.isArray(setCookie)
        ? (setCookie as string[]).find((c: string) => c.startsWith('csrf-token='))
        : setCookie;

      expect(csrfCookie).toBeDefined();
      if (csrfCookie) {
        expect(csrfCookie).toContain('HttpOnly');
        expect(csrfCookie).toContain('Secure');
        expect(csrfCookie).toContain('SameSite=Strict');
      }
    });
  });
});
