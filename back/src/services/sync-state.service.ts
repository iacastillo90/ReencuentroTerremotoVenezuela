/**
 * services/sync-state.service.ts — Estado de sincronización (dedup + checksum)
 *
 * PROPÓSITO:
 *   Previene procesamiento duplicado de datos de fuentes externas
 *   mediante checksum MD5 y tracking de estado. Es el "middleware de
 *   deduplicación" que evita re-procesar datos ya sincronizados.
 *
 * CARACTERÍSTICAS:
 *   - generateChecksum: MD5 determinístico de cualquier payload
 *   - checkSyncState: Verifica si el payload es nuevo o cambió
 *   - markSyncSuccess: Registra estado exitoso (checksum + timestamp)
 *   - markSyncError: Registra error sin sobrescribir checksum previo
 *   - stableStringify: JSON.stringify determinístico (keys ordenadas)
 *
 * FLUJO DE DEDUPLICACIÓN:
 *   1. Payload entrante → generateChecksum → checksum MD5
 *   2. Busca SyncStateModel.findOne({ source, externalId })
 *   3. Si existe y mismo checksum y fecha no más nueva → skip (no_changes)
 *   4. Si no existe o cambió → process (continuar con ingesta)
 *   5. Después de procesar → markSyncSuccess con nuevo checksum
 *   6. Si falla → markSyncError con mensaje de error
 *
 * FLUJO DE SALTOS:
 *   1. Misma fuente + mismo externalId + mismo checksum → 100% skip
 *   2. Misma fuente + mismo externalId + checksum diferente → re-procesar
 *   3. Misma fuente + mismo externalId + payloadUpdatedAt más reciente → re-procesar
 *
 * @module sync-state.service
 */
import { SyncStateModel } from '../models/sync-state.model';
import { createHash } from 'crypto';

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function generateChecksum(payload: any): string {
  const dataString = stableStringify(payload);
  return createHash('md5').update(dataString).digest('hex');
}

export type DeduplicationResult = 
  | { status: 'skipped'; reason: 'no_changes' }
  | { status: 'process'; checksum: string };

/**
 * Validates if the incoming payload is new or changed compared to the last sync.
 * This acts as the "middleware de deduplicación".
 */
export async function checkSyncState(
  source: string,
  externalId: string,
  payload: any,
  payloadUpdatedAt?: Date
): Promise<DeduplicationResult> {
  const checksum = generateChecksum(payload);
  
  const existingState = await SyncStateModel.findOne({ source, externalId });

  if (existingState) {
    const isSameChecksum = existingState.checksum === checksum;
    const isNotNewer = payloadUpdatedAt ? payloadUpdatedAt.getTime() <= existingState.lastProcessed.getTime() : true;

    if (isSameChecksum && isNotNewer) {
      return { status: 'skipped', reason: 'no_changes' };
    }
  }

  return { status: 'process', checksum };
}

/**
 * Call this function after successful processing to record the state.
 */
export async function markSyncSuccess(
  source: string,
  externalId: string,
  checksum: string
): Promise<void> {
  await SyncStateModel.findOneAndUpdate(
    { source, externalId },
    {
      $set: { lastProcessed: new Date(), checksum },
      $inc: { processCount: 1 },
      $unset: { lastError: "" }
    },
    { upsert: true }
  );
}

/**
 * Call this function if processing fails to record the error.
 */
export async function markSyncError(
  source: string,
  externalId: string,
  errorMessage: string
): Promise<void> {
  await SyncStateModel.findOneAndUpdate(
    { source, externalId },
    {
      $set: { lastError: errorMessage },
      $inc: { processCount: 1 }
    },
    { upsert: true }
  );
}
