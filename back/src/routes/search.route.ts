import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';
import { getAIProvider } from '../services/ai/ai.factory';
import { queryPinecone } from '../services/pinecone.service';
import { PersonModel } from '../models/unified-person.model';

const router = Router();

// Rate limiter for vector search (heavy operation)
const vectorSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas. Por favor, intente más tarde.' }
});

const searchQuerySchema = z.object({
  query: sanitizedString.pipe(z.string().min(3).max(500))
});

router.post('/vector', vectorSearchLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = searchQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Consulta inválida o vacía.' });
    }

    const { query } = parseResult.data;

    // 1. Generate embedding for query
    const aiProvider = getAIProvider();
    if (!aiProvider.generateEmbedding) {
      return res.status(501).json({ error: 'Generación de embeddings no soportada' });
    }

    const queryEmbedding = await aiProvider.generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(500).json({ error: 'Error generando embedding para la consulta' });
    }

    // 2. Search Pinecone
    const matches = await queryPinecone(queryEmbedding, 15);
    
    // 3. Fallback a búsqueda de texto si Pinecone falla (matches vacío o error)
    let sortedPersons = [];
    let isFallback = false;

    if (!matches || matches.length === 0) {
      // Fallback a text search básico usando Mongoose
      console.log('[SearchRoute] Pinecone sin resultados, usando fallback $text');
      isFallback = true;
      sortedPersons = await PersonModel.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .lean();
    } else {
      // 4. Retrieve Person records for Pinecone matches
      const idHashes = matches.map((m: any) => m.id);
      const persons = await PersonModel.find({ idHash: { $in: idHashes } }).lean();

      // Reorder persons according to Pinecone score
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

    // 5. Apply safe projection (remove PII)
    const sanitizedPersons = sortedPersons.map((p: any) => {
      // Create a shallow copy to modify safely
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
    console.error('[SearchRoute] POST /vector Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const searchRouter = router;
