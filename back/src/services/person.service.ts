/**
 * services/person.service.ts — Servicio de personas (mutaciones)
 *
 * PROPÓSITO:
 *   Operaciones de escritura sobre personas:
 *   - upsertPerson: crear/actualizar con deduplicación por idHash
 *   - createPerson: validar source + encolar IA
 *   - closeCase: cierre de caso con auditoría
 *
 *   Las operaciones de solo lectura (getPersons, getCounts, getMyReports)
 *   están en person-read.service.ts.
 *
 * SEGURIDAD:
 *   - checkSyncState: valida permisos de fuente antes de upsert
 *   - Outbox pattern: garantiza entrega de eventos downstream
 *   - AuditLog: todas las mutaciones quedan registradas
 */
import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { AuditLogModel } from '../models/audit-log.model';
import { connection as redis } from '../config/redis.config';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware';
import { checkSyncState } from './sync-state.service';
import { generateIdHash } from '../utils/hash.util';
import { addToOutbox } from './outbox.service';

export async function upsertPerson(
  source: string,
  externalId: string,
  personData: Partial<UnifiedPerson>
): Promise<UnifiedPerson> {
  const { normalizedName, lastSeen, age } = personData;

  if (!normalizedName || !lastSeen?.state) {
    throw new Error('Missing required fields: normalizedName or lastSeen.state');
  }

  const idHash = generateIdHash(normalizedName, lastSeen.state, age);

  const { externalIds, metadata, ...rest } = personData;

  const updatedMetadata = {
    ...(metadata || {}),
    lastSync: new Date(),
  };

  const fieldsToUpdate: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(updatedMetadata)) {
    if (key === 'createdAt') continue;
    fieldsToUpdate[`metadata.${key}`] = value;
  }

  fieldsToUpdate['metadata.updatedAt'] = new Date();
  fieldsToUpdate.idHash = idHash;

  const result = await PersonModel.findOneAndUpdate(
    { idHash },
    {
      $set: fieldsToUpdate,
      $setOnInsert: {
        'metadata.createdAt': new Date()
      },
      $addToSet: {
        externalIds: { source, id: externalId, addedAt: new Date() }
      }
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  await addToOutbox('person-matching', { idHash, source: 'person-service' });

  if (lastSeen?.coordinates?.coordinates?.length === 2) {
    await addToOutbox('geo-enrich', {
      idHash,
      coordinates: lastSeen.coordinates.coordinates,
    });
  }

  return result as UnifiedPerson;
}

export async function createPerson(payload: { source: string; externalId: string; date?: string; isAnonymous?: boolean; reportedBy?: string; reporterIp?: string }, userId?: string, ip?: string) {
  if (!payload.isAnonymous && userId) {
    payload.reportedBy = userId;
  }
  payload.reporterIp = ip || 'unknown';
  const updatedAt = payload.date ? new Date(payload.date) : new Date();

  const syncState = await checkSyncState(
    payload.source,
    payload.externalId,
    payload,
    updatedAt
  );

  if (syncState.status === 'skipped') {
    return { status: 'skipped', message: 'Record skipped, no changes detected.' };
  }

  await addJobToIAQueue(payload);

  return { status: 'queued', message: 'Record accepted for processing.' };
}

export async function closeCase(idHash: string, userId: string, userRole: string, resolution: string, notes?: string, ip?: string, userAgent?: string) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) throw new NotFoundError('Reporte no encontrado.');

  const isOwner = person.metadata?.reportedBy?.toString() === userId;
  if (!isOwner && userRole !== 'admin') {
    throw new ForbiddenError('No tienes permiso para cerrar este caso.');
  }

  const prevStatus = person.status;
  person.status = resolution === 'erroneous' ? 'unknown' : resolution as UnifiedPerson['status'];

  if (resolution === 'erroneous') {
    person.metadata.auditStatus = 'dismissed';
  }

  await person.save();

  await AuditLogModel.create({
    eventType: 'admin_action' as const,
    severity: 'info' as const,
    actor: userId,
    action: 'case_closed',
    resource: idHash,
    detail: {
      previousStatus: prevStatus,
      newStatus: person.status,
      resolutionNotes: notes,
    },
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown',
    timestamp: new Date(),
  });

  await redis.del('persons:counts');

  return { message: 'Caso cerrado exitosamente.', status: person.status };
}
