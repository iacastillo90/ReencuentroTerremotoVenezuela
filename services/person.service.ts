import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { generateIdHash } from '../util/hash.util';

export async function upsertPerson(
  source: string,
  externalId: string,
  personData: Partial<UnifiedPerson>
): Promise<UnifiedPerson> {
  if (!personData.normalizedName || !personData.lastSeen?.state) {
    throw new Error('Missing required fields: normalizedName or lastSeen.state');
  }

  const idHash = generateIdHash(personData.normalizedName, personData.lastSeen.state, personData.age);

  // Extract fields to avoid overwriting externalIds manually
  const { externalIds, metadata, ...rest } = personData;

  // Flatten the fields for $set
  const fieldsToUpdate: Record<string, any> = { ...rest };
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      fieldsToUpdate[`metadata.${key}`] = value;
    }
  }
  fieldsToUpdate['metadata.lastSync'] = new Date();
  
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

  return result as UnifiedPerson;
}
