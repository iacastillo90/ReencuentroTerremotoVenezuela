import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';
import { getAIProvider } from '../services/ai/ai.factory';
import { queryPinecone } from '../services/pinecone.service';
import { PersonModel } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';

const searchQuerySchema = z.object({
  query: sanitizedString.pipe(z.string().min(3).max(500))
});

export async function vectorSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = searchQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Consulta inválida o vacía.' });
    }

    const { query } = parseResult.data;

    const aiProvider = getAIProvider();
    if (!aiProvider.generateEmbedding) {
      return res.status(501).json({ error: 'Generación de embeddings no soportada' });
    }

    const queryEmbedding = await aiProvider.generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(500).json({ error: 'Error generando embedding para la consulta' });
    }

    const matches = await queryPinecone(queryEmbedding, 15);

    let sortedPersons: any[] = [];
    let isFallback = false;

    if (!matches || matches.length === 0) {
      logger.info('[SearchRoute] Pinecone empty, using $text fallback');
      isFallback = true;
      sortedPersons = await PersonModel.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .lean();
    } else {
      const idHashes = matches.map((m: any) => m.id);
      const persons = await PersonModel.find({ idHash: { $in: idHashes } }).lean();

      const personsMap = new Map(persons.map(p => [p.idHash, p]));
      sortedPersons = matches
        .map((m: any) => {
          const person = personsMap.get(m.id);
          if (person) {
            return { ...person, score: m.score };
          }
          return null;
        })
        .filter(p => p !== null);
    }

    const sanitizedPersons = sortedPersons.map((p: any) => {
      const cleanPerson = { ...p };
      if (cleanPerson.data) {
        cleanPerson.data = { ...cleanPerson.data };
        delete cleanPerson.data.cedula;
        delete cleanPerson.data.cedula_hash;
        delete cleanPerson.data.contactPerson;
      }
      return cleanPerson;
    });

    return res.status(200).json({ matches: sanitizedPersons, fallback: isFallback });
  } catch (error) {
    next(error);
  }
}
