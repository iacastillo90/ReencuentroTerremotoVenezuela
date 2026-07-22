/**
 * workers/matching.worker.ts — Worker de matching de personas
 *
 * PROPÓSITO:
 *   Procesa eventos del outbox 'person-matching'. Cada vez que se crea
 *   o actualiza una persona, este worker ejecuta el algoritmo de matching
 *   para encontrar coincidencias con personas existentes en la BD.
 *   Es el worker más ligero — solo encola y loguea.
 *
 * CARACTERÍSTICAS:
 *   - Procesa jobs de la cola 'person-matching'
 *   - Delega todo el trabajo pesado a matcher.service
 *   - Logging estructurado con idHash y source
 *   - Error handling: Captura errores sin crash del worker
 *
 * FLUJO DE DATOS:
 *   1. outbox.service crea evento 'person-matching' tras upsertPerson
 *   2. BullMQ encola job en cola 'person-matching'
 *   3. Este worker recibe el job con { idHash, source }
 *   4. runMatchingForNewPerson busca coincidencias en BD
 *   5. Crea entradas en MatchModel con scores y status='revisar'
 *
 * SEGURIDAD:
 *   - try/catch en job handler: Previene crash del worker
 *   - Logger captura error con trace completo
 *   - No expone datos sensibles en logs (solo idHash y source)
 *
 * DECISIONES TÉCNICAS:
 *   - Worker minimalista: La lógica pesada está en matcher.service
 *   - { connection: connection as any }: Conexión Redis compartida
 *   - Single responsibility: Solo matching, no IA, no geo
 *
 * CÓMO USAR:
 *   // Encolar desde outbox:
 *   await addToOutbox('person-matching', { idHash: 'abc123', source: 'web-form' });
 *   // Worker procesa automáticamente
 */
import { Worker } from 'bullmq';
import { connection } from '../config/redis.config';
import { runMatchingForNewPerson } from '../services/matcher.service';
import { logger } from '../utils/logger.util';

export const personMatchingWorker = new Worker('person-matching', async (job) => {
  const { idHash, source } = job.data;
  logger.info({ idHash, source }, '[matching-worker] Processing match');
  try {
    await runMatchingForNewPerson(idHash);
  } catch (error) {
    logger.error({ err: error, idHash, source }, '[matching-worker] Failed to process match');
  }
}, { connection: connection as any, stalledInterval: 300000 });
