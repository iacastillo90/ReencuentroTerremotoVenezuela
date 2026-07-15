/**
 * services/bridge.service.ts — Puente legacy → nuevo sistema
 *
 * PROPÓSITO:
 *   Sirve como puente durante la migración del sistema legacy (SQL)
 *   hacia la nueva arquitectura (MongoDB + colas). Escribe en ambos
 *   sistemas simultáneamente (dual write) y encola para procesamiento
 *   por IA.
 *
 * CARACTERÍSTICAS:
 *   - ingestDualWrite: Persiste en legacy SQL + encola a IA queue
 *   - Error tolerante: Si legacy falla, lanza error. Si IA queue falla, solo log.
 *   - addBulk: Encola múltiples registros en una sola operación
 *
 * FLUJO DE DATOS:
 *   1. Records llegan desde adaptadores externos (n8n, scraping)
 *   2. legacyStore.upsertMediaBatch: Persiste en SQL legacy
 *   3. iaProcessQueue.addBulk: Encola para procesamiento IA
 *   4. Si legacy falla → throw (rollback upstream)
 *   5. Si IA queue falla → solo log (no crítico)
 *
 * SEGURIDAD:
 *   - No validación aquí: Los records deben venir ya validados
 *   - Error propagation: Fallo en legacy bloquea la operación
 *   - Graceful degradation: IA queue fallo no bloquea
 *
 * @module bridge.service
 */
import { iaProcessQueue } from '../queues/ia-process.queue';
import { legacyStore } from './legacy/legacy.store';
import { logger } from '../utils/logger.util';

export async function ingestDualWrite(records: any[]): Promise<void> {
  if (!records || records.length === 0) return;

  try {
    await legacyStore.upsertMediaBatch(records);
    logger.info({ count: records.length }, '[bridge] Records persisted to legacy SQL');
  } catch (error: any) {
    logger.error({ err: error }, '[bridge] Legacy SQL persistence failed');
    throw error;
  }

  try {
    const jobs = records.map(record => ({ name: 'process', data: record }));
    await iaProcessQueue.addBulk(jobs);
    logger.info({ count: records.length }, '[bridge] Records enqueued to ia-process');
  } catch (error: any) {
    logger.error({ err: error }, '[bridge] Error enqueuing to IA queue');
  }
}
