import request from 'supertest';
import app from '../../app';

jest.mock('../../services/storage.service', () => ({
  uploadMedia: jest.fn().mockResolvedValue('http://minio/test/uploaded-file.jpg'),
  initializeStorage: jest.fn().mockResolvedValue(undefined),
  getPresignedUrl: jest.fn().mockResolvedValue('http://minio/test.jpg'),
  getPresignedUploadUrl: jest.fn().mockResolvedValue('http://minio/upload.jpg'),
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

const FAKE_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02, 0x03, 0x04]);

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

describe('Media Route Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal upload', () => {
    it('should return 200 for a valid file upload', async () => {
      const response = await withCsrf(
        request(app)
          .post('/api/media')
          .attach('file', FAKE_JPEG, 'test-image.jpg')
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^https?:\/\//);
    });
  });

  describe('Rate limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
      const csrfRes = await request(app).get('/api/auth/csrf-token');
      const cookies = Array.isArray(csrfRes.headers['set-cookie'])
        ? csrfRes.headers['set-cookie'] as string[]
        : [csrfRes.headers['set-cookie'] as string].filter(Boolean);
      const csrfCookie = cookies.find((c: string) => c.startsWith('csrf-token='));
      const csrfValue = csrfCookie?.split(';')[0] || '';
      const csrfToken = csrfRes.body.token;

      for (let i = 0; i < 9; i++) {
        const res = await request(app)
          .post('/api/media')
          .set('Cookie', csrfValue)
          .set('x-csrf-token', csrfToken)
          .attach('file', FAKE_JPEG, `test-${i}.jpg`);
        expect(res.status).not.toBe(429);
      }

      const eleventh = await request(app)
        .post('/api/media')
        .set('Cookie', csrfValue)
        .set('x-csrf-token', csrfToken)
        .attach('file', FAKE_JPEG, 'test-11.jpg');

      expect(eleventh.status).toBe(429);
    });
  });
});
