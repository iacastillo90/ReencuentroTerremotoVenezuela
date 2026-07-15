/**
 * services/matches.service.ts — Coincidencias (matches) entre reportes
 *
 * PROPÓSITO:
 *   Consulta matches generados por el motor de matching. Verifica
 *   que el usuario tenga permiso para ver los matches de un reporte
 *   (ownership check) y popula los datos de la persona matchada
 *   con una proyección segura (sin PII sensible).
 *
 * CARACTERÍSTICAS:
 *   - getMatchesByReport: Obtiene matches de un reporte específico
 *   - Ownership check: user/role validation
 *   - Proyección segura: Solo campos públicos (idHash, name, status, age, etc.)
 *   - Populate manual: MatchModel find → PersonModel find con $in
 *
 * safeProjection:
 *   idHash, name, type, status, gender, age, lastSeen, description,
 *   photoUrl, data.origen, data.ficha_url, data.verificado_por,
 *   metadata.createdAt, metadata.urgencyScore
 *
 * FLUJO DE DATOS:
 *   1. Verificar que el reporte existe (PersonModel.findOne)
 *   2. Verificar ownership (userId === reportedBy O role admin/moderator)
 *   3. Buscar matches en MatchModel ordenados por score DESC
 *   4. Extraer matchedPersonIds de los matches
 *   5. PersonModel.find con $in + safeProjection
 *   6. Mapear matches → { match, matchedPerson }
 *   7. Filtrar nulls (matches sin persona encontrada)
 *
 * SEGURIDAD:
 *   - ForbiddenError si no hay ownership: Previene fuga de datos
 *   - safeProjection: No expone embedding, faceEncoding, metadata interno
 *   - lean en ambas queries: Sin hidratación Mongoose
 *   - filter null: No devuelve matches huérfanos
 *
 * @module matches.service
 */
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
