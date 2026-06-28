import { Queue } from 'bullmq';
import { legacyStore } from './legacy/legacy.store';

const redisConfig = {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
};

const iaProcessQueue = new Queue('ia-process', redisConfig);

/**
 * Patrón de Escritura Dual (Dual Write) para la persistencia.
 * Mantiene compatibilidad con AyudaVE v2.0 (SQL/legacy) y emite eventos
 * hacia el hub de IA de MongoDB para el ecosistema TDD actual.
 */
export async function ingestDualWrite(records: any[]): Promise<void> {
  if (!records || records.length === 0) return;

  // 1. Escritura síncrona en PostgreSQL (Tablas Originales - Legacy)
  try {
    await legacyStore.upsertMediaBatch(records);
    console.log(`[bridge] Persistidos ${records.length} registros en SQL (Legacy AyudaVE)`);
  } catch (error: any) {
    console.error('[bridge] Fallo crítico de persistencia en SQL legacy:', error.message);
    throw error; // Falla rápido para asegurar integridad relacional
  }

  // 2. Transmisión asíncrona hacia BullMQ → ecosistema MongoDB + IA
  try {
    const jobs = records.map(record => ({ name: 'process', data: record }));
    await iaProcessQueue.addBulk(jobs);
    console.log(`[bridge] ${records.length} registros encolados a 'ia-process' para IA`);
  } catch (error: any) {
    // No lanzamos error: el registro SQL ya fue exitoso.
    console.error('[bridge] Advertencia: Error encolando flujo hacia la IA:', error.message);
  }
}
