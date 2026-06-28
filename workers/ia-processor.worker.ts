import { Worker, Job } from 'bullmq';
import { upsertPerson } from '../services/person.service';
import { connection } from '../config/redis.config';
import { getAIProvider } from '../services/ai/ai.factory';

export const iaProcessorWorker = new Worker('ia-process', async (job: Job) => {
  const rawData = job.data;
  
  // 1. Fase de Análisis IA
  const aiProvider = getAIProvider();
  
  // Convert rawData to a string representation for the AI
  const rawTextToAnalyze = JSON.stringify({
    name: rawData.name,
    description: rawData.description || 'No specific description provided',
    estado: rawData.estado
  });
  
  const aiResult = await aiProvider.processRecord(rawTextToAnalyze);
  
  const aiProcessedText = aiResult.safeDescription; 
  const urgencyScore = aiResult.urgencyScore;

  
  // 2. Persistencia Idempotente en el Hub MongoDB usando el servicio
  const ageNum = rawData.data?.age ? Number(rawData.data.age) : undefined;
  
  const person = await upsertPerson(
    rawData.source || 'manual',
    rawData.externalId || job.id || 'unknown',
    {
      type: rawData.type || 'person',
      name: rawData.name,
      normalizedName: String(rawData.name).toLowerCase(),
      lastSeen: {
        description: aiProcessedText,
        state: rawData.estado,
        date: rawData.date ? new Date(rawData.date) : new Date()
      },
      age: ageNum,
      metadata: {
        urgencyScore: urgencyScore,
        confidenceScore: rawData.confidence_score,
        confidenceLabel: rawData.confidence_label,
        aiProcessed: true,
        auditStatus: 'clean',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSync: new Date(),
        source: rawData.source || 'manual'
      }
    }
  );

  console.log(`[ia-processor] Registro procesado e inyectado en Mongo. idHash: ${person.idHash}`);
}, { connection: connection as any });

