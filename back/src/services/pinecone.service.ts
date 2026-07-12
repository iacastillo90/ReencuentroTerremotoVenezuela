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
