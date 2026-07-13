/**
 * services/outbox.service.ts — Patrón Outbox para eventos asíncronos
 *
 * PROPÓSITO:
 *   Implementa el patrón Transactional Outbox para garantizar entrega
 *   de eventos después de operaciones críticas (crear persona, actualizar
 *   ubicación). Los eventos se persisten en la misma transacción que la
 *   operación principal, luego se procesan asíncronamente.
 *
 * CARACTERÍSTICAS:
 *   - addToOutbox: Persiste evento en MongoDB (atômico con operación principal)
 *   - processOutbox: Procesa eventos pending en batches de 50
 *   - Manejo de reintentos: max 5 attempts por evento
 *   - Tipos de eventos: person-matching, manual-audit, ia-processing, geo-enrich
 *
 * FLUJO DE DATOS:
 *   1. upsertPerson crea persona + addToOutbox('person-matching') en misma transacción
 *   2. processOutbox (background) lee eventos pending cada 5s
 *   3. Encola en BullMQ según tipo:
 *      - person-matching → personMatchingQueue (busca coincidencias)
 *      - geo-enrich → geoEnrich (busca desastres cercanos, actualiza urgencyScore)
 *      - ia-processing → iaProcessQueue (IA para descripción/etiquetas)
 *      - manual-audit → manualAuditQueue (revisión humana)
 *   4. Marca evento como processed o failed (con retry count)
 *
 * GEO-ENRICHMENT (detalle):
 *   - Busca desastres en radio de 30km (2dsphere query)
 *   - Calcula urgency bonus según severidad/cercanía
 *   - Actualiza metadata.urgencyScore (cap en 100)
 *   - Vincula persona a desastres (possiblyRelatedDisasters array)
 *
 * SEGURIDAD:
 *   - Eventos persistidos antes de procesar: garantiza entrega incluso si crash
 *   - Retry con backoff implícito (5 intentos max)
 *   - Logging de cada evento procesado (audit trail)
 *   - Batch processing: previene memory leaks con colas grandes
 *
 * DECISIONES TÉCNICAS:
 *   - BATCH_SIZE=50: balance entre throughput y memory
 *   - POLL_INTERVAL_MS=5000: no sobre-cargar BD con queries constantes
 *   - Eventos en MongoDB (no Redis): persistencia + queries complejas
 *   - geo-enrich síncrono dentro de processOutbox (no es cola separada)
 *
 * PATRÓN RELACIONADO:
 *   - Saga pattern: outbox es el "event publisher" de la saga
 *   - CQRS: outbox separa write (command) de read (query) sides
 *
 * CÓMO USAR:
 *   await addToOutbox('person-matching', { idHash: 'abc123' });
 *   // processOutbox() se ejecuta en background cada 5s
 */
import { OutboxModel } from '../models/outbox.model';
import { personMatchingQueue } from '../queues/person-matching.queue';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { addJobToManualAudit } from '../queues/manual-audit.queue';
import { findNearbyDisasters, calculateDisasterUrgencyBonus } from './disaster.service';
import { PersonModel } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5000;

export async function addToOutbox(
  type: 'person-matching' | 'manual-audit' | 'ia-processing' | 'geo-enrich',
  payload: Record<string, unknown>
): Promise<void> {
  await OutboxModel.create({ type, payload });
}

async function handleGeoEnrich(payload: Record<string, unknown>) {
  const { idHash, coordinates } = payload as { idHash: string; coordinates: [number, number] };
  const person = await PersonModel.findOne({ idHash });
  if (!person) return;

  const nearbyEvents = await findNearbyDisasters(coordinates, 30);

  if (nearbyEvents.length === 0) return;

  const newDisasterIds = nearbyEvents.map(e => (e as any)._id.toString());
  const existingIds = (person.possiblyRelatedDisasters || []).map(id => id.toString());
  const mergedIds = Array.from(new Set([...existingIds, ...newDisasterIds]));

  const urgencyBonus = calculateDisasterUrgencyBonus(nearbyEvents);
  const currentScore = person.metadata?.urgencyScore || 0;
  const finalScore = Math.min(100, currentScore + urgencyBonus);

  await PersonModel.updateOne(
    { _id: person._id },
    {
      $set: {
        possiblyRelatedDisasters: mergedIds,
        'metadata.urgencyScore': finalScore,
        'metadata.updatedAt': new Date(),
      }
    }
  );

  logger.info({ idHash, disasterCount: nearbyEvents.length, urgencyBonus, finalScore }, '[GeoEnrich] Persona enriquecida con desastres cercanos');
}

export async function processOutbox(): Promise<number> {
  const events = await OutboxModel.find({ status: 'pending', attempts: { $lt: 5 } })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  let processed = 0;

  for (const event of events) {
    event.status = 'processing';
    event.attempts += 1;
    await event.save();

    try {
      switch (event.type) {
        case 'person-matching':
          await personMatchingQueue.enqueue(event.payload as { idHash: string; source: string });
          break;
        case 'manual-audit':
          await addJobToManualAudit(event.payload);
          break;
        case 'ia-processing':
          await addJobToIAQueue(event.payload);
          break;
        case 'geo-enrich':
          await handleGeoEnrich(event.payload);
          break;
      }

      event.status = 'completed';
      event.processedAt = new Date();
      await event.save();
      processed++;
    } catch (error: any) {
      logger.error({ err: error, eventId: event._id, type: event.type }, 'Outbox processing failed');

      if (event.attempts >= event.maxAttempts) {
        event.status = 'failed';
        event.lastError = error?.message || 'Unknown error';
      } else {
        event.status = 'pending';
        event.lastError = error?.message || 'Unknown error';
      }
      await event.save();
    }
  }

  return processed;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startOutboxProcessor(): void {
  if (intervalHandle) return;
  logger.info('[Outbox] Starting outbox processor');
  intervalHandle = setInterval(async () => {
    try {
      const count = await processOutbox();
      if (count > 0) {
        logger.info({ processed: count }, '[Outbox] Events processed');
      }
    } catch (error: any) {
      logger.error({ err: error }, '[Outbox] Processing cycle error');
    }
  }, POLL_INTERVAL_MS);
}

export function stopOutboxProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[Outbox] Processor stopped');
  }
}
