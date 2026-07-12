import { PersonModel } from '../models/unified-person.model';
import { ISourceAdapter } from '../adapters/base.adapter';
import { generateIdHash } from '../utils/hash.util';
import { personPayloadSchema } from '../validators/person.validator';
import { logger } from '../utils/logger.util';

interface SyncOptions {
  source: string;
  adapter: ISourceAdapter;
  usingMock?: boolean;
}

interface SyncResult {
  processed: number;
}

export async function syncFromSource<T>(
  items: T[],
  options: SyncOptions,
): Promise<SyncResult> {
  const { source, adapter, usingMock } = options;
  let processed = 0;
  const operations: any[] = [];

  for (const item of items) {
    try {
      const rawPayload = adapter.normalize(item);
      const validation = personPayloadSchema.safeParse(rawPayload);
      if (!validation.success) {
        logger.warn({ issues: validation.error.issues, source }, 'Skipping item — Zod validation failed');
        continue;
      }
      const payload = validation.data;
      const externalId = payload.externalId;
      if (!externalId) continue;

      const idHash = generateIdHash(payload.name.toLowerCase().trim(), payload.estado, payload.data?.age ? Number(payload.data.age) : undefined);
      const now = new Date();

      const normalizedName = payload.name.toLowerCase().trim();

      operations.push({
        updateOne: {
          filter: { idHash },
          update: {
            $set: {
              type: payload.type,
              normalizedName,
              name: payload.name,
              status: 'missing',
              age: payload.data?.age ? Number(payload.data.age) : null,
              lastSeen: {
                date: payload.date ? new Date(payload.date) : new Date(),
                state: payload.estado,
                description: payload.text || '',
              },
              photoUrl: payload.photoUrl || null,
              externalIds: [{ source, id: externalId, addedAt: now }],
              metadata: {
                urgencyScore: 80,
                confidenceScore: 90,
                source: usingMock ? `${source}-mock` : source,
                isSimulated: !!usingMock,
                createdAt: now,
                updatedAt: now,
              },
            },
          },
          upsert: true,
        },
      });

      processed++;
    } catch (err: any) {
      logger.warn({ err, source }, 'Skipping item — normalization failed');
    }
  }

  if (operations.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < operations.length; i += chunkSize) {
      await PersonModel.bulkWrite(operations.slice(i, i + chunkSize));
    }
  }

  return { processed };
}
