import { PersonModel } from '../models/unified-person.model';

export async function getPartnerCases(filter: any, limit: number, offset: number) {
  const cases = await PersonModel.find(filter)
    .select('name status age gender description lastSeen photoUrl aliases contactPerson type metadata.createdAt metadata.updatedAt metadata.source metadata.urgencyScore metadata.confidenceLabel metadata.auditStatus')
    .sort({ 'metadata.createdAt': -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await PersonModel.countDocuments(filter);

  return { data: cases, total, offset, limit };
}
