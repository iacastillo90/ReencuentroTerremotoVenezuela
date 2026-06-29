import { PersonModel } from '../models/unified-person.model';
import { SearchRequestModel } from '../models/search-request.model';
import { MatchModel } from '../models/match.model';
import { queryPinecone } from './pinecone.service';
import { getAIProvider } from './ai/ai.factory';

// Helper de similitud del coseno para cálculo local
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Servicio básico de matching. En el futuro esto puede ser reemplazado
 * por búsquedas vectoriales (embeddings) o IA real.
 */
export async function runMatchingForSearchRequest(searchRequestId: string) {
  try {
    const request = await SearchRequestModel.findById(searchRequestId);
    if (!request || request.status !== 'activa') return;

    // 1. Validar si el SearchRequest ya tiene embedding
    let queryEmbedding = request.embedding;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      const aiProvider = getAIProvider();
      if (aiProvider.generateEmbedding) {
        queryEmbedding = await aiProvider.generateEmbedding(`Nombre: ${request.searchName}. ${request.description || ''}`);
        // Guardar para el futuro
        request.embedding = queryEmbedding;
        await request.save();
      }
    }

    if (!queryEmbedding) return;

    // 2. Determinar el entorno de ejecución
    const useAtlas = process.env.USE_ATLAS_VECTOR_SEARCH === 'true';
    const usePinecone = process.env.USE_PINECONE_VECTOR_SEARCH === 'true';

    let candidates: any[] = [];

    if (usePinecone) {
      // Pinecone Vector Search
      const pcMatches = await queryPinecone(queryEmbedding, 10);
      candidates = pcMatches.map(m => ({
        idHash: m.id,
        score: m.score || 0
      }));
    } else if (useAtlas) {
      // Atlas Vector Search Pipeline
      candidates = await PersonModel.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 10
          }
        },
        {
          $project: {
            idHash: 1,
            name: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);
    } else {
      // Cálculo Local (Similitud del Coseno manual)
      // En un entorno de producción local, esto trae toda la base de datos a memoria (ok para prototipos).
      // Se podría filtrar previamente por "estado" o "status" para no colapsar.
      const allPersons = await PersonModel.find({ embedding: { $exists: true, $ne: [] } }).select('+embedding').lean();
      
      const scoredPersons = allPersons.map(p => {
        const score = cosineSimilarity(queryEmbedding!, p.embedding!);
        return { ...p, score };
      });
      
      candidates = scoredPersons.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // 3. Evaluar e insertar Matches
    for (const candidate of candidates) {
      const score = candidate.score;
      if (score > 0.6) { // Umbral de similitud semántica
        await MatchModel.findOneAndUpdate(
          { reportId: candidate.idHash, searchRequestId: request._id },
          { score, status: score > 0.85 ? 'probable' : 'posible' },
          { upsert: true, new: true }
        );
      }
    }
    
    console.log(`[Matcher] Vector Search completado para SearchRequest ${searchRequestId}. Uso Atlas: ${useAtlas}. Matches encontrados: ${candidates.length}`);

  } catch (error) {
    console.error('[Matcher] Error running matching:', error);
  }
}

export async function runMatchingForNewPerson(personIdHash: string) {
  try {
    const person = await PersonModel.findOne({ idHash: personIdHash }).lean();
    if (!person) return;

    let personEmbedding = person.embedding;
    if (!personEmbedding || personEmbedding.length === 0) {
      // Fetch it specifically because it is select: false
      const fullPerson = await PersonModel.findById(person._id).select('+embedding').lean();
      personEmbedding = fullPerson?.embedding;
    }
    
    if (!personEmbedding || personEmbedding.length === 0) return;

    const useAtlas = process.env.USE_ATLAS_VECTOR_SEARCH === 'true';
    const usePinecone = process.env.USE_PINECONE_VECTOR_SEARCH === 'true';
    
    let matchingRequests: any[] = [];

    if (usePinecone) {
      // Nota: Si los SearchRequests también se guardan en el index de Pinecone con un prefijo 'req_'
      // se pueden buscar, pero generalmente buscamos Personas vs Requests.
      // Aquí, si 'person' busca a sus 'requests' asume que están guardados.
      // Por simplicidad, si es Pinecone podemos usarlo igual:
      const pcMatches = await queryPinecone(personEmbedding, 10);
      matchingRequests = pcMatches.map(m => ({
        _id: m.id, // Suponiendo que guardamos el id del request
        score: m.score || 0
      }));
    } else if (useAtlas) {
      matchingRequests = await SearchRequestModel.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index_requests',
            path: 'embedding',
            queryVector: personEmbedding,
            numCandidates: 100,
            limit: 10
          }
        },
        {
          $project: {
            _id: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);
    } else {
      const allRequests = await SearchRequestModel.find({ 
        status: 'activa', 
        embedding: { $exists: true, $ne: [] } 
      }).select('+embedding').lean();
      
      const scoredRequests = allRequests.map(r => {
        const score = cosineSimilarity(personEmbedding!, r.embedding!);
        return { ...r, score };
      });
      
      matchingRequests = scoredRequests.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    for (const request of matchingRequests) {
      const score = request.score;
      if (score > 0.6) {
        await MatchModel.findOneAndUpdate(
          { reportId: person.idHash, searchRequestId: request._id },
          { score, status: score > 0.85 ? 'probable' : 'posible' },
          { upsert: true, new: true }
        );
      }
    }

  } catch (error) {
    console.error('[Matcher] Error running matching for new person:', error);
  }
}
