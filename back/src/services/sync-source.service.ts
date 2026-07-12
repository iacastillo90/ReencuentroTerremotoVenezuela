import { ISourceAdapter } from '../adapters/base.adapter';
import { personPayloadSchema } from '../validators/person.validator';
import { logger } from '../utils/logger.util';
import { upsertPerson } from './person.service';
import type { UnifiedPerson } from '../models/unified-person.model';

interface SyncOptions {
  source: string;
  adapter: ISourceAdapter;
  usingMock?: boolean;
}

interface SyncResult {
  processed: number;
  failed: number;
}

export async function syncFromSource<T>(
  items: T[],
  options: SyncOptions,
): Promise<SyncResult> {
  const { source, adapter, usingMock } = options;
  let processed = 0;
  let failed = 0;
  const chunkSize = 100;
  const batch: Array<{ payload: any; externalId: string }> = [];

  for (const item of items) {
    try {
      const rawPayload = adapter.normalize(item);
      const validation = personPayloadSchema.safeParse(rawPayload);
      if (!validation.success) {
        logger.warn({ issues: validation.error.issues, source }, 'Skipping item — Zod validation failed');
        failed++;
        continue;
      }
      const payload = validation.data;
      const externalId = payload.externalId;
      if (!externalId) {
        failed++;
        continue;
      }

      batch.push({ payload, externalId });
    } catch (err: any) {
      logger.warn({ err, source }, 'Skipping item — normalization failed');
      failed++;
    }
  }

  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map(({ payload, externalId }) =>
        upsertPerson(source, externalId, {
          type: payload.type,
          name: payload.name,
          normalizedName: payload.name.toLowerCase().trim(),
          status: 'missing',
          age: payload.data?.age ? Number(payload.data.age) : undefined,
          lastSeen: {
            date: payload.date ? new Date(payload.date) : new Date(),
            state: payload.estado,
            description: payload.text || '',
          },
          photoUrl: payload.photoUrl || undefined,
          metadata: {
            urgencyScore: 80,
            confidenceScore: 90,
            source: usingMock ? `${source}-mock` : source,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSync: new Date(),
          } as UnifiedPerson['metadata'],
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        logger.warn({ err: result.reason, source }, 'Failed to upsert item');
        failed++;
      }
    }
  }

  return { processed, failed };
}
