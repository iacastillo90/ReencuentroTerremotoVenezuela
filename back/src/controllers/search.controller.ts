/**
 * controllers/search.controller.ts — Búsqueda vectorial con IA
 *
 * PROPÓSITO:
 *   Endpoint de búsqueda semántica usando embeddings vectoriales.
 *   Convierte una consulta en texto a embedding (vía AI provider),
 *   busca en Pinecone los vectores más similares, y retorna las
 *   personas coincidentes. Con fallback a $text search de MongoDB.
 *
 * CARACTERÍSTICAS:
 *   - vectorSearch: Búsqueda semántica con embeddings
 *   - Fallback automático a MongoDB $text search
 *   - Sanitización de PII en resultados (elimina cedula, contactPerson)
 *   - Zod validation: query min 3, max 500 caracteres
 *
 * FLUJO DE DATOS:
 *   1. Usuario envía POST con { query: "descripción de la persona" }
 *   2. Zod valida (searchQuerySchema con sanitizedString)
 *   3. AI provider genera embedding de la consulta
 *   4. Pinecone query: busca top 15 vectores más cercanos
 *   5. Si Pinecone vacío: Fallback a $text search de MongoDB
 *   6. Recupera documentos completos vía idHash
 *   7. Sanitiza: elimina cedula, cedula_hash, contactPerson
 *   8. Retorna matches ordenados por score
 *
 * SEGURIDAD:
 *   - sanitizedString: Previene XSS en query (elimina HTML/JS)
 *   - Zod min 3 / max 500: Previene ReDoS y consultas masivas
 *   - Eliminación de PII en resultados: cedula, contactPerson
 *   - Fallback protegido: $text search escapa caracteres especiales
 *   - Rate limiting global aplica
 *
 * ENDPOINT:
 *   POST /api/search/vector — Búsqueda semántica
 *
 * DECISIONES TÉCNICAS:
 *   - Fallback a $text: No depende 100% de Pinecone
 *   - 15 matches de Pinecone: Balance entre recall y performance
 *   - lean(): Máxima performance en consultas
 *   - isFallback flag: Frontend sabe si es búsqueda exacta o semántica
 *
 * @module search.controller
 */
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
