import request from 'supertest';
import app from '../app';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { upsertPerson } from '../services/person.service';
import { PersonModel } from '../models/unified-person.model';

jest.mock('../queues/manual-audit.queue', () => ({
  manualAuditQueue: {
    getWaiting: jest.fn(),
    getJob: jest.fn()
  }
}));

jest.mock('../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

jest.mock('../services/person.service', () => ({
  upsertPerson: jest.fn()
}));

jest.mock('../models/unified-person.model', () => ({
  PersonModel: {
    findOne: jest.fn()
  }
}));

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockJob = {
    id: 'job-1',
    timestamp: 123456789,
    data: {
      incoming: {
        source: 'telegram',
        externalId: 'ext-1',
        personData: { name: 'Luis Perez' }
      },
      candidates: [{ idHash: 'hash-1', name: 'Luis Perez' }]
    },
    remove: jest.fn().mockResolvedValue(true)
  };

  describe('GET /api/admin/audit', () => {
    it('should list waiting jobs', async () => {
      (manualAuditQueue.getWaiting as jest.Mock).mockResolvedValue([mockJob]);

      const response = await request(app).get('/api/admin/audit');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].jobId).toBe('job-1');
    });
  });

  describe('POST /api/admin/audit/:jobId/merge', () => {
    it('should return 400 if targetIdHash is missing', async () => {
      const response = await request(app).post('/api/admin/audit/job-1/merge').send({});
      expect(response.status).toBe(400);
    });

    it('should merge successfully if job and target exist', async () => {
      (manualAuditQueue.getJob as jest.Mock).mockResolvedValue(mockJob);
      (PersonModel.findOne as jest.Mock).mockResolvedValue({
        idHash: 'hash-1',
        name: 'Luis Perez',
        normalizedName: 'luis perez',
        age: 30
      });
      (upsertPerson as jest.Mock).mockResolvedValue({ idHash: 'hash-1' });

      const response = await request(app)
        .post('/api/admin/audit/job-1/merge')
        .send({ targetIdHash: 'hash-1' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('merged');
      expect(upsertPerson).toHaveBeenCalledWith(
        'telegram',
        'ext-1',
        expect.objectContaining({ 
          name: 'Luis Perez', 
          metadata: expect.objectContaining({ auditStatus: 'merged' }) 
        })
      );
      expect(mockJob.remove).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/audit/:jobId/dismiss', () => {
    it('should dismiss and insert as new', async () => {
      (manualAuditQueue.getJob as jest.Mock).mockResolvedValue(mockJob);
      (upsertPerson as jest.Mock).mockResolvedValue({ idHash: 'hash-new' });

      const response = await request(app)
        .post('/api/admin/audit/job-1/dismiss')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('inserted_as_new');
      expect(upsertPerson).toHaveBeenCalledWith(
        'telegram',
        'ext-1',
        expect.objectContaining({ 
          metadata: expect.objectContaining({ auditStatus: 'clean' }) 
        })
      );
      expect(mockJob.remove).toHaveBeenCalled();
    });
  });
});
