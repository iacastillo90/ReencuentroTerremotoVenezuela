/**
 * services/legacy/legacy.store — Store legacy (PostgreSQL v2.0)
 *
 * PROPÓSITO:
 *   Stub del store legacy de Reencuentro Terremoto Venezuela (SQL/PostgreSQL,
 *   tablas originales v2.0). En producción se conectaría a PostgreSQL.
 *   Mantenido para compatibilidad con el patrón Dual Write del bridge.
 *
 * CARACTERÍSTICAS:
 *   - upsertMediaBatch: simula inserción en tablas legacy relacionales
 *   - getSyncState / updateSyncState: simula estado de sincronización
 *
 * @module legacy.store
 */

import { logger } from '../../utils/logger.util';

export const legacyStore = {
  async upsertMediaBatch(records: any[]): Promise<boolean> {
    // Stub: simula la inserción en las tablas legacy relacionales de Reencuentro Terremoto Venezuela
    logger.info({ count: records.length }, '[legacyStore] Simulando inserción en PostgreSQL');
    return true;
  },

  async getSyncState(key: string): Promise<null> {
    // Siempre simular registro nuevo (testing inicial)
    return null;
  },

  async updateSyncState(key: string, checksum: string): Promise<void> {
    // Stub
  }
};
