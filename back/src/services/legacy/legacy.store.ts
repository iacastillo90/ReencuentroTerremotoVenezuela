import { logger } from '../../utils/logger.util';

/**
 * Stub del store legacy de Reencuentro Terremoto Venezuela (SQL/PostgreSQL - Tablas originales v2.0).
 * En producción, este módulo se conectaría al cliente de PostgreSQL (pg / TypeORM).
 * Mantenido aquí para compatibilidad con el patrón Dual Write del bridge.
 */
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
