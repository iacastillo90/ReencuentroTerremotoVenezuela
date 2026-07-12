import { PersonModel } from '../models/unified-person.model';
import { DisasterEventModel } from '../models/disaster-event.model';
import { distance } from 'fastest-levenshtein';
import mongoose from 'mongoose';
import { runConcurrent } from '../utils/run-concurrent.util';
import { logger } from '../utils/logger.util';

const CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || '10', 10);
const CHUNK_SIZE = parseInt(process.env.BATCH_CHUNK_SIZE || '200', 10);

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - distance(a, b)) / maxLen;
}

export async function runGeospatialCrossover() {
  logger.info('[Reconcile] Iniciando cruce geoespacial...');

  const persons = await PersonModel.find({
    'lastSeen.coordinates': { $exists: true, $ne: null },
    possiblyRelatedDisasters: { $size: 0 }
  }).limit(500);

  const geoMatches: Array<{
    idHash: string;
    disasterIds: mongoose.Types.ObjectId[];
    urgencyBoost: boolean;
  }> = [];

  await runConcurrent(persons, CONCURRENCY, async (person) => {
    if (!person.lastSeen?.coordinates) return;

    const coords = person.lastSeen.coordinates.coordinates;

    const nearbyDisasters = await DisasterEventModel.find({
      coordinates: {
        $near: {
          $geometry: { type: 'Point', coordinates: coords },
          $maxDistance: 50000
        }
      }
    });

    if (nearbyDisasters.length === 0) return;

    geoMatches.push({
      idHash: person.idHash,
      disasterIds: nearbyDisasters.map(d => d._id as mongoose.Types.ObjectId),
      urgencyBoost: nearbyDisasters.some(d => d.severity === 'high' || d.severity === 'critical'),
    });
  });

  let updatedCount = 0;

  for (let i = 0; i < geoMatches.length; i += CHUNK_SIZE) {
    const chunk = geoMatches.slice(i, i + CHUNK_SIZE);
    const operations = chunk.map(m => {
      const update: Record<string, any> = {
        $set: { possiblyRelatedDisasters: m.disasterIds },
      };
      if (m.urgencyBoost) {
        update.$inc = { 'metadata.urgencyScore': 15 };
      }
      return {
        updateOne: {
          filter: { idHash: m.idHash },
          update,
          upsert: false,
        },
      };
    });

    try {
      const result = await PersonModel.bulkWrite(operations);
      updatedCount += result.modifiedCount;
      logger.info({ chunk: Math.floor(i / CHUNK_SIZE) + 1, modifiedCount: result.modifiedCount }, '[reconcile] Geo chunk updated');
    } catch (error) {
      logger.error({ chunk: Math.floor(i / CHUNK_SIZE) + 1, error }, '[reconcile] Geo chunk failed');
    }
  }

  logger.info({ updatedCount }, '[Reconcile] Geo crossover completado.');
}

export async function runFuzzyMatching() {
  logger.info('[Reconcile] Iniciando fuzzy matching para detectar duplicados...');

  const candidates = await PersonModel.find({
    'metadata.auditStatus': 'clean'
  }).limit(1000).lean();

  const idsToFlag = new Set<string>();

  // Pre-group by status+state to avoid wasted cross-group comparisons
  const groups = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = `${c.status}|${c.lastSeen?.state || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const groupArray = Array.from(groups.values());

  await runConcurrent(groupArray, 4, async (group) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const sim = similarity(group[i].normalizedName, group[j].normalizedName);
        if (sim > 0.85) {
          idsToFlag.add(group[i]._id.toString());
          idsToFlag.add(group[j]._id.toString());
        }
      }
      if (i % 50 === 49) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  });

  const idArray = Array.from(idsToFlag).map(id => new mongoose.Types.ObjectId(id));
  let totalFlagged = 0;

  for (let i = 0; i < idArray.length; i += CHUNK_SIZE) {
    const chunk = idArray.slice(i, i + CHUNK_SIZE);
    try {
      const result = await PersonModel.updateMany(
        { _id: { $in: chunk } },
        { $set: { 'metadata.auditStatus': 'pending_review' as const } }
      );
      totalFlagged += result.modifiedCount;
      logger.info({ chunk: Math.floor(i / CHUNK_SIZE) + 1, flagged: result.modifiedCount }, '[reconcile] Fuzzy chunk flagged');
    } catch (error) {
      logger.error({ chunk: Math.floor(i / CHUNK_SIZE) + 1, error }, '[reconcile] Fuzzy chunk failed');
    }
  }

  const duplicateCount = idsToFlag.size / 2;
  logger.info({ duplicateCount }, '[Reconcile] Fuzzy matching completado.');
}
