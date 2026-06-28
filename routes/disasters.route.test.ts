import request from 'supertest';
import app from '../app';
import { DisasterEventModel } from '../models/disaster-event.model';

jest.mock('../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../queues/manual-audit.queue', () => ({
  manualAuditQueue: {
    getWaiting: jest.fn(),
    getJob: jest.fn()
  }
}));

jest.mock('../models/disaster-event.model', () => ({
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

    it('should filter by type and dates', async () => {
      await request(app).get('/api/disasters?type=flood&from=2026-01-01&to=2026-12-31');
      expect(DisasterEventModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flood',
          occurredAt: { $gte: new Date('2026-01-01'), $lte: new Date('2026-12-31') }
        })
      );
    });

    it('should use $near for geospatial query', async () => {
      await request(app).get('/api/disasters?lat=10.48&lng=-66.9&radius=50');
      
      const calls = (DisasterEventModel.find as jest.Mock).mock.calls;
      const filter = calls[0][0];
      
      expect(filter.coordinates.$near.$maxDistance).toBe(50000); // 50km in meters
      expect(filter.coordinates.$near.$geometry.coordinates).toEqual([-66.9, 10.48]);
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
