process.env.CSP_ENFORCE = 'true';

import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../../src/queues/manual-audit.queue', () => ({
  manualAuditQueue: { getWaiting: jest.fn(), getJob: jest.fn() },
  addJobToManualAudit: jest.fn()
}));

jest.mock('../../src/config/redis.config', () => ({
  connection: {}
}));

jest.mock('../../src/services/storage.service', () => ({
  uploadMedia: jest.fn(),
  getPresignedUrl: jest.fn(),
  getPresignedUploadUrl: jest.fn(),
  initializeStorage: jest.fn(),
  minioClient: {},
}));

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
  requirePartnerApiKey: jest.fn((_req: any, _res: any, next: any) => next()),
  getJwtSecret: jest.fn(() => 'test-secret'),
}));

jest.mock('../../src/models/disaster-event.model', () => ({
  DisasterEventModel: {
    find: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../../src/models/unified-person.model', () => ({
  PersonModel: {
    find: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
  }
}));

jest.mock('../../src/services/sync-state.service', () => ({
  checkSyncState: jest.fn()
}));

describe('App Security Headers', () => {
  it('should include Strict-Transport-Security header', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
  });

  it('should include Content-Security-Policy header', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('should include Referrer-Policy header', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should return 200 on health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
