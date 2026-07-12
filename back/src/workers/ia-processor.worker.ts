import 'dotenv/config';
import { z } from 'zod';
import { Worker, Job } from 'bullmq';
import { connectDB } from '../database/connection';
import { processAndReconcilePerson } from '../services/reconciliation.service';
import { connection } from '../config/redis.config';
import { getAIProvider } from '../services/ai/ai.factory';
import { upsertVectorToPinecone } from '../services/pinecone.service';
import { emitToUser } from '../services/socket.service';
import { UnifiedPerson } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';

const aiOutputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  estado: z.string().min(1).max(100).optional(),
  age: z.number().int().positive().max(150).optional(),
  urgencyScore: z.number().min(0).max(100).optional(),
  safeDescription: z.string().max(10000).optional(),
});

connectDB('Worker');

const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';

async function extractFaceEncoding(imageUrl: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${VISION_SERVICE_URL}/extract-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, '[ia-processor] Vision service returned error');
      return null;
    }

    const result = await response.json();

    if (!result.face_detected || !result.face_encoding) {
      logger.info('[ia-processor] No face detected in image');
      return null;
    }

    logger.info({ dims: result.face_encoding.length }, '[ia-processor] Face encoding extracted');
    return result.face_encoding;
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      logger.warn('[ia-processor] Vision service timeout (35s)');
    } else {
      logger.warn({ err: error }, '[ia-processor] Vision service error');
    }
    return null;
  }
}

export const iaProcessorWorker = new Worker('ia-process', async (job: Job) => {
  const rawData = job.data;
  
  try {
    const isMinor = rawData.isMinor === true;
    let aiProcessedText = rawData.text || 'Sin descripción';
    let urgencyScore = isMinor ? 10 : 1;
    let personName = rawData.name || 'Desconocido';
    let personState = rawData.estado || 'Desconocido';
    let personAge = rawData.data?.age ? Number(rawData.data.age) : undefined;
    let embedding: number[] | undefined = undefined;
    let faceEncoding: number[] | undefined = undefined;

    if (!isMinor) {
      const aiProvider = getAIProvider();
      
      const rawTextToAnalyze = typeof rawData.text === 'string' 
        ? rawData.text 
        : JSON.stringify(rawData);
      
      let aiResult: any = null;
      try {
        aiResult = await aiProvider.processRecord(rawTextToAnalyze);
        const validated = aiOutputSchema.safeParse(aiResult);
        if (!validated.success) {
          logger.warn({ issues: validated.error.issues }, '[ia-processor] AI output validation failed, using raw fields');
        } else {
          aiResult = validated.data;
        }
      } catch (error) {
        logger.error({ err: error }, '[ia-processor] AI API Error, falling back to manual fields');
      }
      
      aiProcessedText = aiResult?.safeDescription || aiProcessedText; 
      urgencyScore = aiResult?.urgencyScore || urgencyScore;
      personName = aiResult?.name || personName;
      personState = aiResult?.estado || personState;
      personAge = aiResult?.age || personAge;
      
      // Generar Embedding Vectorial (texto) solo para adultos
      if (aiProvider.generateEmbedding) {
        const textToEmbed = `Nombre: ${personName}. Estado: ${personState}. Edad: ${personAge || 'Desconocida'}. Descripción: ${aiProcessedText}`;
        try {
          embedding = await aiProvider.generateEmbedding(textToEmbed);
        } catch (e) {
          logger.warn({ err: e }, '[ia-processor] Error generating text embedding');
        }
      }
    }
    
    // 2. Extraer encoding facial si hay foto (solo adultos, por protección LOPNNA)
    if (!isMinor && rawData.photoUrl) {
      faceEncoding = (await extractFaceEncoding(rawData.photoUrl)) || undefined;
    }

    // 3. Reconciliación e Inserción Idempotente
    const personData = {
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
      faceEncoding: faceEncoding,
      metadata: {
        urgencyScore: urgencyScore,
        confidenceScore: rawData.confidence_score,
        confidenceLabel: rawData.confidence_label,
        aiProcessed: !isMinor,
        isMinor: isMinor,
        auditStatus: ((!rawData.source || rawData.source === 'manual') ? 'pending_moderation' : 'clean') as UnifiedPerson['metadata']['auditStatus'],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSync: new Date(),
        source: rawData.source || 'manual',
        reportedBy: rawData.reportedBy,
        reporterIp: rawData.reporterIp,
        reporterLocation: rawData.reporterLocation
      }
    };

    const personDataValidation = z.object({
      type: z.enum(['person', 'animal']),
      name: z.string().min(1).max(200),
      normalizedName: z.string().min(1).max(200),
      lastSeen: z.object({
        description: z.string().max(10000),
        state: z.string().min(1).max(100),
        date: z.date(),
      }),
      age: z.number().int().positive().max(150).optional(),
      photoUrl: z.string().max(2000).optional(),
      embedding: z.array(z.number()).optional(),
      faceEncoding: z.array(z.number()).optional(),
      metadata: z.object({
        urgencyScore: z.number().min(0).max(100),
        confidenceScore: z.number().optional(),
        confidenceLabel: z.string().optional(),
        aiProcessed: z.boolean(),
        isMinor: z.boolean(),
        auditStatus: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        lastSync: z.date(),
        source: z.string(),
        reportedBy: z.any().optional(),
        reporterIp: z.string().optional(),
        reporterLocation: z.any().optional(),
      }),
    });

    const validation = personDataValidation.safeParse(personData);
    if (!validation.success) {
      logger.error({ issues: validation.error.issues, jobId: job.id }, '[ia-processor] Person data validation failed');
      throw new Error('Person data validation failed');
    }

    const result = await processAndReconcilePerson(
      rawData.source || 'manual',
      rawData.externalId || job.id || 'unknown',
      personData
    );

    // 4. Guardar en Pinecone si está activo y hay embedding
    if (embedding && result.idHash && process.env.USE_PINECONE_VECTOR_SEARCH === 'true') {
      await upsertVectorToPinecone(result.idHash, embedding, {
        name: personName,
        status: 'missing',
        state: personState
      });
    }

    // 5. Guardar faceEncoding en Pinecone (índice separado o mismo con prefijo)
    if (faceEncoding && result.idHash && process.env.USE_PINECONE_VECTOR_SEARCH === 'true') {
      await upsertVectorToPinecone(`face_${result.idHash}`, faceEncoding, {
        name: personName,
        status: 'missing',
        state: personState,
        type: 'face'
      });
    }

    // 6. Notificar al usuario creador por WebSocket en tiempo real
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
        logger.warn({ err }, '[ia-processor] Socket notification failed');
      }
    }

    logger.info({ status: result.status, idHash: result.idHash }, '[ia-processor] Record reconciled');
  } catch (error: any) {
    logger.error({ err: error, jobId: job.id }, '[ia-processor] Job failed');
    if (error.name === 'ValidationError') {
      logger.error({ details: error.errors }, '[ia-processor] Mongoose validation error');
    }
    throw error;
  }
}, { connection: connection as any });
