/**
 * models/sync-state.model.ts — Estado de sincronización de fuentes
 *
 * PROPÓSITO:
 *   Trackea el estado de sincronización de cada fuente externa para
 *   evitar procesamiento duplicado. Cada registro representa un ítem
 *   de una fuente (externalId + source) con su checksum MD5, timestamp
 *   de último procesamiento, conteo de procesos, y último error.
 *
 * CARACTERÍSTICAS:
 *   - externalId + source: Unique compound index (clave de dedup)
 *   - checksum: MD5 del payload (detección de cambios)
 *   - lastProcessed: Última vez que se procesó exitosamente
 *   - processCount: Número de veces procesado
 *   - lastError: Mensaje del último error (si falló)
 *
 * @module sync-state.model
 */
import { Schema, model, Document } from 'mongoose';

export interface SyncState extends Document {
  externalId: string;
  source: string;
  lastProcessed: Date;
  checksum: string;
  processCount: number;
  lastError?: string;
}

const SyncStateSchema = new Schema<SyncState>({
  externalId: { type: String, required: true },
  source: { type: String, required: true },
  lastProcessed: { type: Date, required: true, default: Date.now },
  checksum: { type: String, required: true },
  processCount: { type: Number, default: 0 },
  lastError: { type: String }
});

SyncStateSchema.index({ externalId: 1, source: 1 }, { unique: true });

export const SyncStateModel = model<SyncState>('SyncState', SyncStateSchema);
