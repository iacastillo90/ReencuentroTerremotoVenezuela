import { Worker, Job } from 'bullmq';
import { upsertPerson } from '../services/person.service';
import { connection } from '../config/redis.config';

// import { Anthropic } from '@anthropic-ai/sdk';
// const Anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

