import { PersonModel, UnifiedPerson } from '../models/unified-person.model';
import { AuditLogModel } from '../models/audit-log.model';
import { connection as redis } from '../config/redis.config';
import { addJobToIAQueue } from '../queues/ia-process.queue';
import { NotFoundError, ForbiddenError } from '../middlewares/error.middleware';
import { safeRegexQuery } from '../utils/regex-escape.util';
import { toPublicPerson } from '../utils/person-view.util';
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

  const fieldsToUpdate: Record<string, any> = { ...rest };
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
    { upsert: true, new: true, runValidators: true }
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

export async function getCounts() {
  const CACHE_KEY = 'persons:counts';
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const LOCK_KEY = CACHE_KEY + ':lock';
  const lockAcquired = await redis.set(LOCK_KEY, '1', 'PX', 10000, 'NX');
  if (!lockAcquired) {
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 200));
      const recheck = await redis.get(CACHE_KEY);
      if (recheck) return JSON.parse(recheck);
    }
  }

  try {
    const [missing, found, total, pending, manual, animals] = await Promise.all([
      PersonModel.countDocuments({ status: 'missing', type: { $ne: 'animal' }, 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
      PersonModel.countDocuments({ status: 'found', type: { $ne: 'animal' }, 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
      PersonModel.countDocuments({ 'metadata.auditStatus': { $ne: 'pending_moderation' } }),
      PersonModel.countDocuments({ 'metadata.auditStatus': 'pending_review' }),
      PersonModel.countDocuments({ 'metadata.source': 'manual' }),
      PersonModel.countDocuments({ type: 'animal', 'metadata.auditStatus': { $ne: 'pending_moderation' } })
    ]);

    const counts = { missing, found, total, pending, manual, animals };
    await redis.setex(CACHE_KEY, 300, JSON.stringify(counts));
    return counts;
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
}

const safeProjection = {
  idHash: 1,
  type: 1,
  name: 1,
  status: 1,
  'lastSeen.state': 1,
  'lastSeen.municipality': 1,
  'lastSeen.description': 1,
  'lastSeen.date': 1,
  'lastSeen.coordinates': 1,
  age: 1,
  gender: 1,
  description: 1,
  photoUrl: 1,
  'metadata.createdAt': 1,
  'metadata.urgencyScore': 1
};

export async function getMyReports(userId: string, limit: number, offset: number) {
  const [persons, total] = await Promise.all([
    PersonModel.find({ 'metadata.reportedBy': userId })
      .select(safeProjection)
      .sort({ 'metadata.createdAt': -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    PersonModel.countDocuments({ 'metadata.reportedBy': userId }),
  ]);

  return { data: persons, total, limit, offset };
}

const publicProjection = {
  idHash: 1,
  type: 1,
  name: 1,
  status: 1,
  'lastSeen.state': 1,
  'lastSeen.municipality': 1,
  'lastSeen.description': 1,
  'lastSeen.date': 1,
  'lastSeen.coordinates': 1,
  age: 1,
  gender: 1,
  description: 1,
  photoUrl: 1,
  'data.origen': 1,
  'data.ficha_url': 1,
  'data.verificado_por': 1,
  'metadata.createdAt': 1,
  'metadata.urgencyScore': 1,
  'metadata.reportedBy': 1,
  'metadata.isMinor': 1
};

interface GetPersonsParams {
  q?: string;
  status?: string;
  category?: string;
  state?: string;
  municipality?: string;
  limit: number;
  offset: number;
  viewerRole?: string;
}

export async function getPersons(params: GetPersonsParams) {
  const { q, status, category, state, municipality, limit, offset, viewerRole } = params;
  const filter: any = { 'metadata.auditStatus': { $ne: 'pending_moderation' } };

  if (status) {
    filter.status = status;
  }

  if (q) {
    const sanitizedQuery = safeRegexQuery(q);
    if (sanitizedQuery) {
      filter.normalizedName = { $regex: '^' + sanitizedQuery, $options: 'i' };
    }
  }

  if (category) {
    if (category === 'mascota') {
      filter.type = 'animal';
    } else if (category === 'nino') {
      filter.type = 'person';
      filter.age = { $lt: 18 };
    } else if (category === 'adulto') {
      filter.type = 'person';
      filter.age = { $gte: 18, $lt: 65 };
    } else if (category === 'adulto_mayor') {
      filter.type = 'person';
      filter.age = { $gte: 65 };
    }
  }

  if (state) {
    filter['lastSeen.state'] = state;
  }
  if (municipality) {
    filter['lastSeen.municipality'] = { $regex: safeRegexQuery(municipality), $options: 'i' };
  }

  const cacheKey = `persons:q=${q || ''}:status=${status || ''}:cat=${category || ''}:st=${state || ''}:m=${municipality || ''}:l=${limit}:o=${offset}`;

  if (!q && offset === 0) {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  }

  const [rawPersons, total] = await Promise.all([
    PersonModel.find(filter)
      .select(publicProjection)
      .populate('metadata.reportedBy', 'name')
      .sort({ photoUrl: -1, 'metadata.urgencyScore': -1, 'metadata.createdAt': -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    PersonModel.countDocuments(filter)
  ]);

  const persons = rawPersons.map((p: any) => toPublicPerson(p, viewerRole));

  const responsePayload = { total, limit, offset, persons };

  if (!q && offset === 0) {
    await redis.setex(cacheKey, 30, JSON.stringify(responsePayload));
  }

  return responsePayload;
}

export async function createPerson(payload: any, userId?: string, ip?: string) {
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
  person.status = resolution === 'erroneous' ? 'unknown' : (resolution as any);

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
