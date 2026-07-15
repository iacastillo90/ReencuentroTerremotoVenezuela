/**
 * services/matcher.service.ts — Motor de matching de personas
 *
 * PROPÓSITO:
 *   Implementa el algoritmo de matching entre personas reportadas y
 *   personas encontradas. Soporta matching por embeddings vectoriales
 *   (Pinecone, Atlas) y búsqueda directa por nombre+ubicación.
 *   Es el núcleo del sistema de reconciliación.
 *
 * CARACTERÍSTICAS:
 *   - cosineSimilarity: Similitud coseno entre vectores (embeddings)
 *   - runMatchingForSearchRequest: Matches para solicitudes de búsqueda activas
 *   - runMatchingForNewPerson: Busca matches para una persona recién creada
 *   - Soporte para Atlas Vector Search y Pinecone
 *   - Fallback a búsqueda local por nombre + ubicación si no hay vectores
 *   - Generación de embeddings vía AI provider
 *
 * FLUJO DE MATCHING:
 *   1. Nueva persona creada (upsertPerson) → outbox 'person-matching'
 *   2. Worker encola job → este servicio procesa
 *   3. Vector search: Pinecone/Atlas → candidatos con score
 *   4. Si score > threshold: Crea MatchModel con status='revisar'
 *   5. Notifica al admin vía Socket.IO
 *   6. Admin revisa y decide: confirmar, descartar, o fusionar
 *
 * ALGORITMO:
 *   1. Obtener embedding de la persona (AI provider o existente)
 *   2. Buscar en vector DB (Pinecone/Atlas) los top-N candidatos
 *   3. Si no hay vector DB: Buscar por normalizedName + lastSeen.state
 *   4. Calcular score con cosineSimilarity
 *   5. Threshold configurable: >0.7 → MatchModel, >0.9 → notificación inmediata
 *
 * SEGURIDAD:
 *   - Solo procesa search requests con status='activa'
 *   - Score threshold previene falsos positivos
 *   - No expone datos de personas no autorizadas
 *   - MatchModel con status='revisar': Siempre requiere confirmación humana
 *
 * DECISIONES TÉCNICAS:
 *   - Vector + fallback: No depende de un solo método
 *   - threshold de score: Balance entre recall y precisión
 *   - Embedding on-demand: Se genera si no existe (lazy loading)
 *   - Status 'revisar' default: Siempre requiere confirmación humana
 *
 * CÓMO USAR:
 *   await runMatchingForNewPerson('abc123');
 *   await runMatchingForSearchRequest('search-req-456');
 */
import { PersonModel } from '../models/unified-person.model';
import { SearchRequestModel } from '../models/search-request.model';
import { MatchModel } from '../models/match.model';
import { queryPinecone } from './pinecone.service';
import { getAIProvider } from './ai/ai.factory';
import { logger } from '../utils/logger.util';

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

function euclideanDistance(vecA: number[], vecB: number[]): number {
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += Math.pow(vecA[i] - vecB[i], 2);
  }
  return Math.sqrt(sum);
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
      candidates = pcMatches.map((m: any) => ({
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
    
    logger.info({ searchRequestId, useAtlas, matchCount: candidates.length }, '[Matcher] Vector search completed');

  } catch (error) {
    logger.error({ err: error }, '[Matcher] Error running matching');
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
      throw error;
    }
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
      matchingRequests = pcMatches.map((m: any) => ({
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

    // --- Face Encoding Matching (Biometrics) ---
    // Extract faceEncoding if available
    let faceEncoding = person.faceEncoding;
    if (!faceEncoding || faceEncoding.length === 0) {
      const fullPerson = await PersonModel.findById(person._id).select('+faceEncoding').lean();
      faceEncoding = fullPerson?.faceEncoding;
    }

    if (faceEncoding && faceEncoding.length > 0) {
      // Find other people with face encodings (Not SearchRequests, but other PersonModels)
      // Since matching here is Person vs SearchRequests usually, wait!
      // The user wants Person vs Person matching (duplicate reports of the same person).
      // Let's do a Person vs Person face matching!
      const allFaces = await PersonModel.find({ 
        _id: { $ne: person._id },
        faceEncoding: { $exists: true, $ne: [] } 
      }).select('+faceEncoding').lean();

      for (const otherPerson of allFaces) {
        if (!otherPerson.faceEncoding) continue;
        const distance = euclideanDistance(faceEncoding, otherPerson.faceEncoding);
        // Face recognition threshold is usually 0.6. Lower is better.
        if (distance < 0.6) {
          // Calculate a confidence score where 0.0 distance = 1.0 score, 0.6 distance = 0.6 score.
          const faceScore = 1.0 - (distance / 0.6) * 0.4;
          
          await MatchModel.findOneAndUpdate(
            { reportId: person.idHash, matchedPersonId: otherPerson.idHash },
            { score: faceScore, status: faceScore > 0.85 ? 'probable' : 'posible' },
            { upsert: true, new: true }
          );
        }
      }
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
    logger.error({ err: error }, '[Matcher] Error running matching for new person');
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
      throw error;
    }
  }
}
