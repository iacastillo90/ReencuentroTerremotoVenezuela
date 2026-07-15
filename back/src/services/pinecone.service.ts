/**
 * services/pinecone.service.ts — Cliente Pinecone para búsqueda vectorial
 *
 * PROPÓSITO:
 *   Wrapper alrededor del SDK de Pinecone para operaciones de upsert
 *   y query vectorial. Se usa como backend de búsqueda semántica
 *   (embeddings de personas). Es un servicio opt-in: solo se activa
 *   si PINECONE_API_KEY está definida.
 *
 * CARACTERÍSTICAS:
 *   - upsertVectorToPinecone: Indexa un vector con metadata
 *   - queryPinecone: Busca los top-K vectores más similares
 *   - Lazy initialization: Cliente se crea en primer uso
 *   - Graceful degradation: Si falla, retorna [] en query, log en upsert
 *
 * FLUJO DE DATOS:
 *   1. Persona creada → embedding generado → upsertVectorToPinecone
 *   2. Búsqueda → embedding query → queryPinecone → matches con score
 *   3. Matches se unen con MongoDB por idHash para datos completos
 *
 * SEGURIDAD:
 *   - API key solo en variable de entorno (nunca en código)
 *   - Graceful fallback: Si Pinecone no disponible, no bloquea operaciones
 *   - Metadata incluida: name, status, source para contexto sin join extra
 *
 * DECISIONES TÉCNICAS:
 *   - Lazy init: No consume recursos si no se usa Pinecone
 *   - SDK v8: Usa { records: [...] } (no el array directo de v7)
 *   - includeMetadata: true en query: Evita roundtrip extra a MongoDB
 *
 * @module pinecone.service
 */
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger.util';

let pineconeClient: Pinecone | null = null;

function getPineconeClient() {
  if (!pineconeClient && process.env.PINECONE_API_KEY) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

const getIndexName = () => process.env.PINECONE_INDEX_NAME || 'reencuentro';

export async function upsertVectorToPinecone(id: string, embedding: number[], metadata: any = {}) {
  try {
    const pc = getPineconeClient();
    if (!pc) return;

    const index = pc.Index(getIndexName());
    // SDK Pinecone v8: upsert recibe { records: [...] } (antes era un array directo)
    await index.upsert({
      records: [
        {
          id,
          values: embedding,
          metadata
        }
      ]
    });
    logger.info({ id }, '[Pinecone] Vector upserted');
  } catch (error) {
    logger.error({ err: error }, '[Pinecone] Upsert error');
  }
}

export async function queryPinecone(embedding: number[], topK: number = 10) {
  try {
    const pc = getPineconeClient();
    if (!pc) return [];

    const index = pc.Index(getIndexName());
    const queryResponse = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });
    
    return queryResponse.matches || [];
  } catch (error) {
    logger.error({ err: error }, '[Pinecone] Query error');
    return [];
  }
}
