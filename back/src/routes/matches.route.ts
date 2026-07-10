import { Router, Request, Response } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { MatchModel } from '../models/match.model';
import { PersonModel } from '../models/unified-person.model';

const router = Router();

router.get('/:reportId', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { reportId } = req.params;

    // 1. Authorize: Make sure the requested reportId belongs to this user (unless admin/mod)
    const originalPerson = await PersonModel.findOne({ idHash: reportId }).lean();
    if (!originalPerson) {
      return res.status(404).json({ error: 'Reporte original no encontrado' });
    }

    if (
      userRole !== 'admin' && 
      userRole !== 'moderator' && 
      originalPerson.metadata?.reportedBy?.toString() !== userId
    ) {
      return res.status(403).json({ error: 'No autorizado para ver coincidencias de este reporte' });
    }

    // 2. Fetch matches from MatchModel
    const matches = await MatchModel.find({ reportId }).sort({ score: -1 }).lean();

    if (matches.length === 0) {
      return res.status(200).json([]);
    }

    // 3. Populate UnifiedPerson data for the matches (safely)
    // Extraer todos los idHash que necesitamos buscar
    const matchedPersonIds = matches
      .map(m => m.matchedPersonId)
      .filter(id => id !== undefined);

    if (matchedPersonIds.length === 0) {
      return res.status(200).json([]);
    }

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
      // Excluyendo PII como cedula, cedula_hash, contactPerson
    };

    const matchedPersons = await PersonModel.find({ idHash: { $in: matchedPersonIds } })
      .select(safeProjection)
      .lean();

    const personsMap = new Map(matchedPersons.map(p => [p.idHash, p]));

    const populatedMatches = matches.map(m => {
      const personData = m.matchedPersonId ? personsMap.get(m.matchedPersonId) : null;
      return {
        ...m,
        matchedPerson: personData
      };
    }).filter(m => m.matchedPerson != null); // Remove if person deleted

    return res.status(200).json(populatedMatches);
  } catch (error) {
    console.error('[MatchesRoute] GET /:reportId Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const matchesRouter = router;
