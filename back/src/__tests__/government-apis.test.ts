import { CNEValidatorService } from '../services/scrapers/cne-validator.service';
import { runFunvisisJob } from '../jobs/funvisis.job';
import { DisasterEventModel } from '../models/disaster-event.model';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Integraciones Gubernamentales (Fase 1)', () => {
  describe('CNEValidatorService', () => {
    it('debería retornar inválido para cédulas muy cortas', async () => {
      const result = await CNEValidatorService.validateIdentity('V', '123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Formato de cédula inválido');
    });

    it('debería retornar válido para mock de cédula correcta (termina en 1 o 2)', async () => {
      const result = await CNEValidatorService.validateIdentity('V', '25000001');
      expect(result.valid).toBe(true);
      expect(result.fullName).toContain('CNE');
    });
  });

  describe('FUNVISIS Job', () => {
    it('debería importar sismos usando el fallback mockeado y no duplicar', async () => {
      // Primera ejecución
      await runFunvisisJob();
      let events = await DisasterEventModel.find({ source: 'funvisis-gov' });
      expect(events.length).toBe(1);
      expect(events[0].title).toContain('Sismo');

      // Segunda ejecución (no debe duplicar)
      await runFunvisisJob();
      events = await DisasterEventModel.find({ source: 'funvisis-gov' });
      expect(events.length).toBe(1); // Mismo número, el deduplicador MD5 funcionó
    });
  });
});
