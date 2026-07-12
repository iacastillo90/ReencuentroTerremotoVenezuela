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
