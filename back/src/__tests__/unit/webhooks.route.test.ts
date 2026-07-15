import request from 'supertest';
import app from '../../app';
import { addJobToIAQueue } from '../../queues/ia-process.queue';

jest.mock('../../queues/ia-process.queue', () => ({
  addJobToIAQueue: jest.fn()
}));

const WEBHOOK_API_KEY = 'test-webhook-key';

beforeAll(() => {
  process.env.WEBHOOK_API_KEY = WEBHOOK_API_KEY;
});

describe('Webhooks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook API Key authentication', () => {
    it('should return 401 without x-webhook-api-key header', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n/whatsapp')
        .send({ messageId: 'msg-123', text: 'test', sender: '+584120000000' });

      expect(response.status).toBe(401);
    });

    it('should return 401 with wrong x-webhook-api-key', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n/whatsapp')
        .set('x-webhook-api-key', 'wrong-key')
        .send({ messageId: 'msg-123', text: 'test', sender: '+584120000000' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/webhooks/n8n/whatsapp', () => {
    it('should queue the message and return 202 with correct key', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n/whatsapp')
        .set('x-webhook-api-key', WEBHOOK_API_KEY)
        .send({
          messageId: 'msg-123',
          text: 'Mi hermano Juan Pérez se perdió en Caracas ayer.',
          sender: '+584120000000'
        });

      expect(response.status).toBe(202);
      expect(response.body.status).toBe('queued');
      expect(addJobToIAQueue).toHaveBeenCalledTimes(1);
      
      const payload = (addJobToIAQueue as jest.Mock).mock.calls[0][0];
      expect(payload.source).toBe('whatsapp-n8n');
      expect(payload.text).toBe('Mi hermano Juan Pérez se perdió en Caracas ayer.');
      expect(payload.externalId).toBe('msg-123');
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n/whatsapp')
        .set('x-webhook-api-key', WEBHOOK_API_KEY)
        .send({ sender: '+584120000000' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/webhooks/n8n/telegram', () => {
    it('should queue the message and return 202', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n/telegram')
        .set('x-webhook-api-key', WEBHOOK_API_KEY)
        .send({
          messageId: 'tg-999',
          text: 'Ayuda, no encuentro a mi perrito en Zulia',
          sender: '@usuario'
        });

      expect(response.status).toBe(202);
      expect(addJobToIAQueue).toHaveBeenCalledTimes(1);
      
      const payload = (addJobToIAQueue as jest.Mock).mock.calls[0][0];
      expect(payload.source).toBe('telegram-n8n');
    });
  });
});
