/**
 * services/person-read.service.ts — Consultas de personas (lectura)
 *
 * PROPÓSITO:
 *   Extrae todas las operaciones de solo lectura de person.service.ts
 *   para mantener cada archivo bajo 300 líneas. Incluye:
 *   - getCounts: conteos cacheados en Redis con lock anti-stampede
 *   - getMyReports: reportes de un usuario
 *   - getPersons: búsqueda paginada con filtros
 *
 * PROYECCIONES:
 *   safeProjection: para usuarios autenticados (excluye PII sensible)
 *   publicProjection: para público en general (incluye data.*)
 */
import { PersonModel } from '../models/unified-person.model';
import { connection as redis } from '../config/redis.config';
import { toPublicPerson } from '../utils/person-view.util';
import { safeRegexQuery } from '../utils/regex-escape.util';

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

export async function getPersons(params: GetPersonsParams, viewerRole?: string) {
  const { q, status, category, state, municipality, limit, offset } = params;
  const effectiveViewerRole = viewerRole || params.viewerRole;
  const filter: Record<string, unknown> = { 'metadata.auditStatus': { $ne: 'pending_moderation' } };

  if (status) {
    filter.status = status;
  }

  if (q) {
    const sanitizedQuery = safeRegexQuery(String(q));
    if (sanitizedQuery) {
      filter['normalizedName'] = { $regex: '^' + sanitizedQuery, $options: 'i' };
    }
  }

  if (category) {
    const cat = String(category);
    if (cat === 'mascota') {
      filter['type'] = 'animal';
    } else if (cat === 'nino') {
      filter['type'] = 'person';
      filter['age'] = { $lt: 18 };
    } else if (cat === 'adulto') {
      filter['type'] = 'person';
      filter['age'] = { $gte: 18, $lt: 65 };
    } else if (cat === 'adulto_mayor') {
      filter['type'] = 'person';
      filter['age'] = { $gte: 65 };
    }
  }

  if (state) {
    filter['lastSeen.state'] = String(state);
  }
  if (municipality) {
    filter['lastSeen.municipality'] = { $regex: safeRegexQuery(String(municipality)), $options: 'i' };
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

  const persons = rawPersons.map((p) => toPublicPerson(p, effectiveViewerRole));

  const responsePayload = { total, limit, offset, persons };

  if (!q && offset === 0) {
    await redis.setex(cacheKey, 30, JSON.stringify(responsePayload));
  }

  return responsePayload;
}
