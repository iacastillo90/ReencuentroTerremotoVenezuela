import { Worker, Job } from 'bullmq';
import { processAndReconcilePerson } from '../services/reconciliation.service';
import { connection } from '../config/redis.config';
import { getAIProvider } from '../services/ai/ai.factory';

export const iaProcessorWorker = new Worker('ia-process', async (job: Job) => {
  const rawData = job.data;
  
  // 1. Fase de Análisis IA
  const aiProvider = getAIProvider();
  
  // Send the full raw data or text to the AI for extraction
  const rawTextToAnalyze = typeof rawData.text === 'string' 
    ? rawData.text 
    : JSON.stringify(rawData);
  
  const aiResult = await aiProvider.processRecord(rawTextToAnalyze);
  
  // 2. Extracted Data
  const aiProcessedText = aiResult.safeDescription; 
  const urgencyScore = aiResult.urgencyScore;
  const personName = aiResult.name || rawData.name || 'Desconocido';
  const personState = aiResult.estado || rawData.estado || 'Desconocido';
  const personAge = aiResult.age || (rawData.data?.age ? Number(rawData.data.age) : undefined);
  
  // Generar Embedding Vectorial (Fase 3)
  let embedding: number[] | undefined = undefined;
  if (aiProvider.generateEmbedding) {
    const textToEmbed = `Nombre: ${personName}. Estado: ${personState}. Edad: ${personAge || 'Desconocida'}. Descripción: ${aiProcessedText}`;
    try {
      embedding = await aiProvider.generateEmbedding(textToEmbed);
    } catch (e) {
      console.warn('[ia-processor] Error generando embedding, ignorando:', e);
    }
  }
  
  // 3. Reconciliación e Inserción Idempotente
  const result = await processAndReconcilePerson(
    rawData.source || 'manual',
    rawData.externalId || job.id || 'unknown',
    {
      type: rawData.type || 'person',
      name: personName,
      normalizedName: String(personName).toLowerCase(),
      lastSeen: {
        description: aiProcessedText,
        state: personState,
        date: rawData.date ? new Date(rawData.date) : new Date()
      },
      age: personAge,
      photoUrl: rawData.photoUrl,
      embedding: embedding,
      metadata: {
        urgencyScore: urgencyScore,
        confidenceScore: rawData.confidence_score,
        confidenceLabel: rawData.confidence_label,
        aiProcessed: true,
        auditStatus: 'clean',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSync: new Date(),
        source: rawData.source || 'manual',
        reportedBy: rawData.reportedBy
      }
    }
  );

  console.log(`[ia-processor] Registro reconciliado (${result.status}). idHash: ${result.idHash || 'pendiente'}`);
}, { connection: connection as any });

