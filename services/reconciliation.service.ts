import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { calculateSimilarity } from '../util/fuzzy-match.util';
import { addJobToManualAudit } from '../queues/manual-audit.queue';
import { upsertPerson } from './person.service';

export interface SimilarityResult {
  person: UnifiedPerson;
  score: number;
}

export async function findSimilarPersons(normalizedName: string, state: string, threshold: number = 0.85): Promise<SimilarityResult[]> {
  // To avoid scanning the entire database, we filter by the state where the person was last seen.
  // In a highly optimized setup, we could use n-grams or text indexes.
  const candidates = await PersonModel.find({ 'lastSeen.state': state }).lean();
  
  const matches: SimilarityResult[] = [];
  
  for (const candidate of candidates) {
    const score = calculateSimilarity(normalizedName, candidate.normalizedName);
    if (score >= threshold) {
      matches.push({ person: candidate as unknown as UnifiedPerson, score });
    }
  }
  
  // Sort from highest similarity to lowest
  return matches.sort((a, b) => b.score - a.score);
}

export async function processAndReconcilePerson(
  source: string,
  externalId: string,
  personData: Partial<UnifiedPerson>
): Promise<{ status: string; idHash?: string; message?: string }> {
  
  if (!personData.normalizedName || !personData.lastSeen?.state) {
    throw new Error('Missing required fields: normalizedName or lastSeen.state');
  }

  const similarCandidates = await findSimilarPersons(personData.normalizedName, personData.lastSeen.state);

  if (similarCandidates.length > 0) {
    const topCandidate = similarCandidates[0];

    if (topCandidate.score >= 0.95) {
      // Auto-merge: high confidence it's the same person.
      // We upsert using the original name and state from the existing DB record to maintain the same idHash.
      const mergedPerson = await upsertPerson(source, externalId, {
        ...personData,
        normalizedName: topCandidate.person.normalizedName,
        name: topCandidate.person.name, // Keep existing name string
        age: topCandidate.person.age, // Keep existing age to ensure idHash stays identical
        metadata: {
          ...personData.metadata,
          auditStatus: 'merged'
        } as any
      });
      return { status: 'auto-merged', idHash: mergedPerson.idHash, message: 'Merged with existing record due to high similarity (>95%).' };
    } else {
      // Send to manual audit queue if similarity is between 85% and 94.9%
      await addJobToManualAudit({
        incoming: { source, externalId, personData },
        candidates: similarCandidates.map(c => ({ idHash: c.person.idHash, name: c.person.name, score: c.score }))
      });
      return { status: 'pending_audit', message: 'Sent to manual audit due to possible duplicate.' };
    }
  }

  // Insert as new record
  const newPerson = await upsertPerson(source, externalId, personData);
  return { status: 'inserted', idHash: newPerson.idHash, message: 'Inserted as new record.' };
}
