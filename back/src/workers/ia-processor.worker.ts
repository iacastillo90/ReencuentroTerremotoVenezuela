import { Worker, Job } from 'bullmq';
import { processAndReconcilePerson } from '../services/reconciliation.service';
import { connection } from '../config/redis.config';
import { getAIProvider } from '../services/ai/ai.factory';
import { upsertVectorToPinecone } from '../services/pinecone.service';
import { emitToUser } from '../services/socket.service';

export const iaProcessorWorker = new Worker('ia-process', async (job: Job) => {
  const rawData = job.data;
  
  try {
    // 1. Fase de Análisis IA
    const aiProvider = getAIProvider();
    
    // Send the full raw data or text to the AI for extraction
    const rawTextToAnalyze = typeof rawData.text === 'string' 
      ? rawData.text 
      : JSON.stringify(rawData);
    
    let aiResult: any = null;
    try {
      aiResult = await aiProvider.processRecord(rawTextToAnalyze);
    } catch (error) {
      console.error('[ia-processor] Gemini API Error (quota or auth), falling back to manual fields:', error);
    }
    
    // 2. Extracted Data
    const aiProcessedText = aiResult?.safeDescription || rawData.text || 'Sin descripción'; 
    const urgencyScore = aiResult?.urgencyScore || 1;
    const personName = aiResult?.name || rawData.name || 'Desconocido';
    const personState = aiResult?.estado || rawData.estado || 'Desconocido';
    const personAge = aiResult?.age || (rawData.data?.age ? Number(rawData.data.age) : undefined);
    
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
          reportedBy: rawData.reportedBy,
          reporterIp: rawData.reporterIp,
          reporterLocation: rawData.reporterLocation
        }
      }
    );

    // 4. Guardar en Pinecone si está activo y hay embedding
    if (embedding && result.idHash && process.env.USE_PINECONE_VECTOR_SEARCH === 'true') {
      await upsertVectorToPinecone(result.idHash, embedding, {
        name: personName,
        status: 'missing',
        state: personState
      });
    }

    // 5. Notificar al usuario creador por WebSocket en tiempo real
    if (rawData.reportedBy) {
      let title = 'Reporte Procesado';
      let message = `El reporte para "${personName}" ha sido procesado exitosamente.`;
      let type: 'success' | 'warning' | 'info' = 'success';

      if (result.status === 'auto-merged') {
        title = 'Reporte Fusionado';
        message = `El reporte para "${personName}" se fusionó con un registro existente debido a alta similitud (>95%).`;
        type = 'info';
      } else if (result.status === 'pending_audit') {
        title = 'Reporte en Auditoría';
        message = `El reporte para "${personName}" está bajo revisión por posible duplicado.`;
        type = 'warning';
      }

      try {
        emitToUser(rawData.reportedBy.toString(), 'notification', {
          title,
          message,
          type,
        });
      } catch (err) {
        console.warn('[ia-processor] No se pudo enviar notificación por socket:', err);
      }
    }

    console.log(`[ia-processor] Registro reconciliado (${result.status}). idHash: ${result.idHash || 'pendiente'}`);
  } catch (error: any) {
    console.error(`[ia-processor] CRITICAL: Job ${job.id} failed during execution:`, error);
    if (error.name === 'ValidationError') {
      console.error('[ia-processor] Mongoose Validation Error Details:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}, { connection: connection as any });

