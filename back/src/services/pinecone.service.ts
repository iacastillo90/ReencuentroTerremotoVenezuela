import { Pinecone } from '@pinecone-database/pinecone';

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
    await index.upsert([
      {
        id,
        values: embedding,
        metadata
      }
    ]);
    console.log(`[Pinecone] Vector upserted for ID: ${id}`);
  } catch (error) {
    console.error('[Pinecone] Upsert Error:', error);
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
    console.error('[Pinecone] Query Error:', error);
    return [];
  }
}
