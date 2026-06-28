import { Worker, Job } from 'bullmq';
import { PersonModel } from '../models/unified-person.model';
import { createHash } from 'crypto';

// import { Anthropic } from '@anthropic-ai/sdk';
// const Anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const redisConfig = { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: 6379 } };

/**
 * Prompt estricto de IA garantizando la protección de PII
 */
const SYSTEM_PROMPT = `
INSTRUCCIÓN DE SISTEMA: Extrae únicamente la última ubicación vista (estado/municipio), descripción física y características no sensibles de la persona.
Elimina, ignora y censura de forma absoluta cualquier número de teléfono, dirección exacta domiciliaria y descripciones de diagnósticos médicos o historia clínica. 
Resume el estado médico SÓLO utilizando estas tres etiquetas de severidad permitidas: "estable", "herido", "crisis".
Bajo ninguna circunstancia expongas información de identidad sensible.
`;

export const iaProcessorWorker = new Worker('ia-process', async (job: Job) => {
  const rawData = job.data;
  
  // 1. Fase de Análisis IA (Anthropic - Comentado por scaffolding)
  // const AnthropicResponse = await Anthropic.messages.create({ ... });
  // Simulación:
  const aiProcessedText = "Descripción segura, sin PII. Estado de salud: estable."; 
  const urgencyScore = 75; // Score calculado por la IA
  
  // 2. Generación del ID Biográfico Hashing (Identidad unificada en TDD)
  const ageStr = rawData.data?.age ? String(rawData.data.age) : 'unknown';
  const baseForHash = `${rawData.name}|${rawData.estado}|${ageStr}`.toLowerCase();
  const idHash = createHash('sha256').update(baseForHash).digest('hex');
  
  // 3. Persistencia Idempotente en el Hub MongoDB
  await PersonModel.findOneAndUpdate(
    { idHash },
    {
      $set: {
        type: rawData.type,
        name: rawData.name,
        normalizedName: String(rawData.name).toLowerCase(),
        'lastSeen.state': rawData.estado,
        'metadata.lastSync': new Date(),
        'metadata.urgencyScore': urgencyScore,
        'metadata.confidenceScore': rawData.confidence_score,
        'metadata.confidenceLabel': rawData.confidence_label,
        'data.cedula_hash': rawData.data?.cedula_hash,
        description: aiProcessedText
      },
      $setOnInsert: { 'metadata.createdAt': new Date(), externalIds: [] },
      $addToSet: { externalIds: { source: rawData.source, id: rawData.externalId } }
    },
    { upsert: true, new: true }
  );

  console.log(`[ia-processor] Registro procesado e inyectado en Mongo. idHash: ${idHash}`);
}, redisConfig);
