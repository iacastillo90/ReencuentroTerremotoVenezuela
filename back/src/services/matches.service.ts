import { MatchModel } from '../models/match.model';
import { PersonModel } from '../models/unified-person.model';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware';

const safeProjection = {
  idHash: 1,
  name: 1,
  type: 1,
  status: 1,
  gender: 1,
  age: 1,
  lastSeen: 1,
  description: 1,
  photoUrl: 1,
  'data.origen': 1,
  'data.ficha_url': 1,
  'data.verificado_por': 1,
  'metadata.createdAt': 1,
  'metadata.urgencyScore': 1
};

export async function getMatchesByReport(reportId: string, userId: string, userRole: string) {
  const originalPerson = await PersonModel.findOne({ idHash: reportId }).lean();
  if (!originalPerson) {
    throw new NotFoundError('Reporte original no encontrado');
  }

  if (
    userRole !== 'admin' &&
    userRole !== 'moderator' &&
    originalPerson.metadata?.reportedBy?.toString() !== userId
  ) {
    throw new ForbiddenError('No autorizado para ver coincidencias de este reporte');
  }

  const matches = await MatchModel.find({ reportId }).sort({ score: -1 }).lean();

  if (matches.length === 0) {
    return [];
  }

  const matchedPersonIds = matches
    .map(m => m.matchedPersonId)
    .filter(id => id !== undefined);

  if (matchedPersonIds.length === 0) {
    return [];
  }

  const matchedPersons = await PersonModel.find({ idHash: { $in: matchedPersonIds } })
    .select(safeProjection)
    .lean();

  const personsMap = new Map(matchedPersons.map(p => [p.idHash, p]));

  const populatedMatches = matches
    .map(m => {
      const personData = m.matchedPersonId ? personsMap.get(m.matchedPersonId) : null;
      if (!personData) return null;
      return { ...m, matchedPerson: personData };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return populatedMatches;
}
