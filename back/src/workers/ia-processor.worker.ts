import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker, Job } from 'bullmq';
import { processAndReconcilePerson } from '../services/reconciliation.service';
import { connection } from '../config/redis.config';
import { getAIProvider } from '../services/ai/ai.factory';
import { upsertVectorToPinecone } from '../services/pinecone.service';
import { emitToUser } from '../services/socket.service';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';
const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';

if (mongoose.connection.readyState === 0) {
  console.log(`[ia-processor] Conectando a MongoDB en ${MONGO_URI}...`);
  mongoose.connect(MONGO_URI)
    .then(() => console.log('[ia-processor] MongoDB Conectado exitosamente.'))
    .catch((err) => console.error('[ia-processor] Error al conectar a MongoDB:', err));
}

async function extractFaceEncoding(imageUrl: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${VISION_SERVICE_URL}/extract-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      console.warn(`[ia-processor] Vision service returned ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (!result.face_detected || !result.face_encoding) {
      console.log('[ia-processor] No face detected in image, skipping face encoding.');
      return null;
    }

    console.log(`[ia-processor] Face encoding extracted (${result.face_encoding.length} dims)`);
    return result.face_encoding;
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.warn('[ia-processor] Vision service timeout (35s), skipping face encoding.');
    } else {
      console.warn('[ia-processor] Vision service error, skipping face encoding:', error?.message || error);
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
      } catch (error) {
        console.error('[ia-processor] AI API Error, falling back to manual fields:', error);
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
          console.warn('[ia-processor] Error generando embedding textual, ignorando:', e);
        }
      }
    }
    
    // 2. Extraer encoding facial si hay foto (siempre, incluso para menores)
    if (rawData.photoUrl) {
      faceEncoding = (await extractFaceEncoding(rawData.photoUrl)) || undefined;
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
        faceEncoding: faceEncoding,
        metadata: {
          urgencyScore: urgencyScore,
          confidenceScore: rawData.confidence_score,
          confidenceLabel: rawData.confidence_label,
          aiProcessed: !isMinor,
          isMinor: isMinor,
          auditStatus: (!rawData.source || rawData.source === 'manual') ? 'pending_moderation' : 'clean',
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
