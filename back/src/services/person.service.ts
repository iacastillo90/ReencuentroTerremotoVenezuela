import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { generateIdHash } from '../utils/hash.util';
import { addToOutbox } from './outbox.service';

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

  // Extract fields to avoid overwriting externalIds manually
  const { externalIds, metadata, ...rest } = personData;

  const updatedMetadata = {
    ...(metadata || {}),
    lastSync: new Date(),
  };

  // Flatten the fields for $set
  const fieldsToUpdate: Record<string, any> = { ...rest };
  for (const [key, value] of Object.entries(updatedMetadata)) {
    if (key === 'createdAt') continue;
    fieldsToUpdate[`metadata.${key}`] = value;
  }

  fieldsToUpdate['metadata.updatedAt'] = new Date();
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

  // Encolar matching via Transactional Outbox
  await addToOutbox('person-matching', { idHash, source: 'person-service' });

  // Encolar enriquecimiento geo (disasters cercanos) — async, no bloquea el response
  if (lastSeen?.coordinates?.coordinates?.length === 2) {
    await addToOutbox('geo-enrich', {
      idHash,
      coordinates: lastSeen.coordinates.coordinates,
    });
  }

  return result as UnifiedPerson;
}
