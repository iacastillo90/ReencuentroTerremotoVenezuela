import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { generateIdHash } from '../utils/hash.util';
import { findNearbyDisasters, calculateDisasterUrgencyBonus } from './disaster.service';
import { runMatchingForNewPerson } from './matcher.service';

export async function upsertPerson(
  source: string,
  externalId: string,
  personData: Partial<UnifiedPerson>
): Promise<UnifiedPerson> {
  const { normalizedName, lastSeen, age } = personData;

  if (!normalizedName || !lastSeen?.state) {
    throw new Error('Missing required fields: normalizedName or lastSeen.state');
  }

  const idHash = generateIdHash(normalizedName, lastSeen.state, age);

  // Lógica de cruce: vincular personas con desastres cercanos
  let relatedDisasterIds = personData.possiblyRelatedDisasters || [];
  let urgencyBonus = 0;

  if (lastSeen.coordinates && lastSeen.coordinates.coordinates.length === 2) {
    const nearbyEvents = await findNearbyDisasters(
      lastSeen.coordinates.coordinates as [number, number],
      30
    );
    
    if (nearbyEvents.length > 0) {
      const newDisasterIds = nearbyEvents.map(e => (e as any)._id);
      // Evitar duplicados si ya existen algunos
      relatedDisasterIds = Array.from(new Set([
        ...relatedDisasterIds.map(id => id.toString()), 
        ...newDisasterIds.map(id => id.toString())
      ])) as any[];
      urgencyBonus = calculateDisasterUrgencyBonus(nearbyEvents);
    }
  }

  // Prevenir que el puntaje pase de 100
  const finalUrgencyScore = Math.min(100, (personData.metadata?.urgencyScore || 0) + urgencyBonus);

  // Extract fields to avoid overwriting externalIds manually
  const { externalIds, metadata, ...rest } = personData;

  const updatedMetadata = {
    ...(metadata || {}),
    lastSync: new Date(),
    urgencyScore: finalUrgencyScore
  };

  // Flatten the fields for $set
  const fieldsToUpdate: Record<string, any> = { ...rest, possiblyRelatedDisasters: relatedDisasterIds };
  for (const [key, value] of Object.entries(updatedMetadata)) {
    fieldsToUpdate[`metadata.${key}`] = value;
  }
  
  // ensure idHash is set if it's an insert
  fieldsToUpdate.idHash = idHash;

  const result = await PersonModel.findOneAndUpdate(
    { idHash },
    {
      $set: fieldsToUpdate,
      $setOnInsert: { 
        'metadata.createdAt': new Date()
      },
      $addToSet: { 
        externalIds: { source, id: externalId, addedAt: new Date() } 
      }
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Ejecutar matching asíncrono
  runMatchingForNewPerson(idHash).catch(console.error);

  return result as UnifiedPerson;
}
