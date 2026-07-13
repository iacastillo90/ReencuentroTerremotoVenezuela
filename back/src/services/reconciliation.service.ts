/**
 * services/reconciliation.service.ts — Motor de reconciliación / dedup
 *
 * PROPÓSITO:
 *   Implementa el algoritmo de reconciliación para detectar si una
 *   persona nueva es duplicado de una existente. Usa similitud de
 *   nombres (fuzzy matching) + coincidencia de ubicación para decidir
 *   entre: auto-merge (>95%), pending audit (85-95%), o insert (nuevo).
 *
 * CARACTERÍSTICAS:
 *   - findSimilarPersons: Busca candidatos similares por nombre + estado
 *   - processAndReconcilePerson: Pipeline completo de reconciliación
 *   - 3 niveles: auto-merge (≥95%), pending audit (≥85%), insert (nuevo)
 *   - Usa calculateSimilarity (fuzzy-match) + Transactional Outbox
 *
 * FLUJO DE RECONCILIACIÓN:
 *   1. Persona nueva llega con normalizedName + lastSeen.state
 *   2. findSimilarPersons: Busca candidatos en mismo estado
 *   3. Regex parcial con primeras 3 palabras del nombre
 *   4. calculateSimilarity compara con cada candidato
 *   5. Si score ≥ 0.95: upsertPerson manteniendo nombre/edad original (mismo idHash)
 *   6. Si score ≥ 0.85: addToOutbox('manual-audit') para revisión humana
 *   7. Si score < 0.85: insert como nuevo registro
 *
 * INTERFACES:
 *   SimilarityResult { person: UnifiedPerson; score: number }
 *
 * SEGURIDAD:
 *   - Regex escapado (escapeRegExp): Previene ReDoS desde nombres maliciosos
 *   - Límite 500 candidatos: Previene DoS por matching masivo
 *   - threshold configurable: 0.85 default (balance recall/precisión)
 *   - auto-merge solo >95%: Previene fusiones incorrectas
 *
 * @module reconciliation.service
 */
import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { calculateSimilarity } from '../utils/fuzzy-match.util';
import { addToOutbox } from './outbox.service';
import { upsertPerson } from './person.service';

export interface SimilarityResult {
  person: UnifiedPerson;
  score: number;
}

export async function findSimilarPersons(normalizedName: string, state: string, threshold: number = 0.85): Promise<SimilarityResult[]> {
  const nameParts = normalizedName.split(' ').filter(Boolean);
  const escapeRegExp = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const safeParts = nameParts.slice(0, 3).map(escapeRegExp);
  const nameFilter = safeParts.length > 0
    ? { normalizedName: { $regex: safeParts.join('|'), $options: 'i' } }
    : {};

  const candidates = await PersonModel.find({
    'lastSeen.state': state,
    ...nameFilter,
  }).limit(500).lean();
  
  const matches: SimilarityResult[] = [];
  
  for (const candidate of candidates) {
    const score = calculateSimilarity(normalizedName, candidate.normalizedName);
    if (score >= threshold) {
      matches.push({ person: candidate as unknown as UnifiedPerson, score });
    }
  }
  
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
      // Send to manual audit queue via Transactional Outbox
      await addToOutbox('manual-audit', {
        incoming: { source, externalId, personData },
        candidates: similarCandidates.map(c => ({ idHash: c.person.idHash, name: c.person.name, score: c.score }))
      } as Record<string, unknown>);
      return { status: 'pending_audit', message: 'Sent to manual audit due to possible duplicate.' };
    }
  }

  // Insert as new record
  const newPerson = await upsertPerson(source, externalId, personData);
  return { status: 'inserted', idHash: newPerson.idHash, message: 'Inserted as new record.' };
}
