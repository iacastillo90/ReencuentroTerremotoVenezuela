import { PersonModel } from '../models/unified-person.model';
import { DisasterEventModel } from '../models/disaster-event.model';
import { distance } from 'fastest-levenshtein';
import mongoose from 'mongoose';
import { runConcurrent } from '../utils/run-concurrent.util';

const CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || '10', 10);
const CHUNK_SIZE = parseInt(process.env.BATCH_CHUNK_SIZE || '200', 10);

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - distance(a, b)) / maxLen;
}

export async function runGeospatialCrossover() {
  console.log('[Reconcile] Iniciando cruce geoespacial...');

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
      console.log(`[reconcile] Geo chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${result.modifiedCount} updated`);
    } catch (error) {
      console.error(`[reconcile] Geo chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed:`, error);
    }
  }

  console.log(`[Reconcile] Cruce geoespacial completado. ${updatedCount} personas vinculadas a desastres.`);
}

export async function runFuzzyMatching() {
  console.log('[Reconcile] Iniciando fuzzy matching para detectar duplicados...');

  const candidates = await PersonModel.find({
    'metadata.auditStatus': 'clean'
  }).limit(1000).lean();

  const idsToFlag = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    const current = candidates[i];
    for (let j = i + 1; j < candidates.length; j++) {
      const other = candidates[j];

      if (current.status !== other.status || current.lastSeen?.state !== other.lastSeen?.state) continue;

      const nameSim = similarity(current.normalizedName, other.normalizedName);

      if (nameSim > 0.85) {
        idsToFlag.add(current._id.toString());
        idsToFlag.add(other._id.toString());
      }
    }
  }

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
      console.log(`[reconcile] Fuzzy chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${result.modifiedCount} flagged`);
    } catch (error) {
      console.error(`[reconcile] Fuzzy chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed:`, error);
    }
  }

  const duplicateCount = idsToFlag.size / 2;
  console.log(`[Reconcile] Fuzzy matching completado. ${duplicateCount} posibles duplicados detectados (auditStatus = pending_review).`);
}
