import request from 'supertest';
import app from '../../app';
import { DisasterEventModel } from '../../models/disaster-event.model';

jest.mock('../../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../../queues/manual-audit.queue', () => ({
  manualAuditQueue: {
    getWaiting: jest.fn(),
    getJob: jest.fn()
  }
}));

jest.mock('../../models/disaster-event.model', () => ({
  DisasterEventModel: {
    find: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      { title: 'Sismo en Caracas', type: 'earthquake' }
    ])
  }
}));

describe('Disasters Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/disasters', () => {
    it('should return disasters', async () => {
      const response = await request(app).get('/api/disasters');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Sismo en Caracas');
      expect(DisasterEventModel.find).toHaveBeenCalledWith({});
    });

    it('should filter by type and date range', async () => {
      await request(app).get('/api/disasters?type=flood&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z');
      expect(DisasterEventModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flood',
          occurredAt: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lte: new Date('2026-12-31T23:59:59.000Z') }
        })
      );
    });

    it('should use $near for geospatial query', async () => {
      await request(app).get('/api/disasters?lat=10.48&lng=-66.9&radius=50');

      const calls = (DisasterEventModel.find as jest.Mock).mock.calls;
      const filter = calls[0][0];

      expect(filter.coordinates.$near.$maxDistance).toBe(50000);
      expect(filter.coordinates.$near.$geometry.coordinates).toEqual([-66.9, 10.48]);
    });
  });

  describe('Query validation (security)', () => {
    it('should reject invalid disaster type', async () => {
      const response = await request(app).get('/api/disasters?type=INVALID_TYPE');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should reject non-date strings in from param', async () => {
      const response = await request(app).get('/api/disasters?from=not-a-date');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should reject NoSQL injection attempts via query params', async () => {
      // Express 5's default querystring parser treats type[$ne] as literal flat key
      // so type is undefined → Zod passes, no injection reaches MongoDB
      const response = await request(app).get('/api/disasters?type[$ne]=test');
      expect(response.status).toBe(200);
      const calls = (DisasterEventModel.find as jest.Mock).mock.calls;
      const filter = calls[0][0];
      expect(filter).not.toHaveProperty('type.$ne');
      expect(filter).not.toHaveProperty('type');
    });
  });

  describe('GET /api/disasters/active', () => {
    it('should query active disasters', async () => {
      const response = await request(app).get('/api/disasters/active');
      expect(response.status).toBe(200);

      const calls = (DisasterEventModel.find as jest.Mock).mock.calls;
      const filter = calls[0][0];
      expect(filter).toHaveProperty('$or');
      expect(filter.$or).toHaveLength(2);
    });
  });
});
