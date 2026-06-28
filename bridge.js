const store = require('./store'); // Legacy AyudaVE SQL store
const { Queue } = require('bullmq');

const redisConfig = { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: 6379 } };
const iaProcessQueue = new Queue('ia-process', redisConfig);

/**
 * Patrón de Escritura Dual (Dual Write) para la persistencia.
 * Mantiene compatibilidad con AyudaVE v2.0 (SQL) y emite eventos para el hub de IA de MongoDB.
 */
async function ingestDualWrite(records) {
  if (!records || records.length === 0) return;

  // 1. Escritura síncrona en PostgreSQL (Tablas Originales 15)
  try {
    await store.upsertMediaBatch(records);
    console.log(`[bridge] Persistidos ${records.length} registros en SQL (Legacy AyudaVE)`);
  } catch (error) {
    console.error('[bridge] Fallo crítico de persistencia en SQL legacy:', error.message);
    throw error; // Falla rápido para asegurar integridad relacional
  }

  // 2. Transmisión asíncrona hacia BullMQ para el ecosistema TDD (MongoDB + IA)
  try {
    const jobs = records.map(record => ({
      name: 'process',
      data: record
    }));
    await iaProcessQueue.addBulk(jobs);
    console.log(`[bridge] ${records.length} registros encolados a 'ia-process' para IA`);
  } catch (error) {
    console.error('[bridge] Advertencia: Error encolando flujo hacia la IA:', error.message);
    // No lanzamos error para no hacer rollback en SQL, ya se insertó con éxito.
  }
}

module.exports = { ingestDualWrite };
