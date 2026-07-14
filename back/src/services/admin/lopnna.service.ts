import { PersonModel } from '../../models/unified-person.model';
import { auditLog } from '../../middlewares/audit.middleware';
import { uploadMedia } from '../storage.service';
import { logger } from '../../utils/logger.util';
import type { Request } from 'express';

const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';

export async function listFlaggedPersons(limit: number, offset: number) {
  const filter: Record<string, unknown> = {
    'metadata.auditStatus': 'flagged_moderation' as const,
    photoUrl: { $exists: true, $ne: null },
  };
  const [persons, total] = await Promise.all([
    PersonModel.find(filter)
      .select('-embedding -faceEncoding')
      .populate('metadata.reportedBy', 'name email')
      .sort({ 'metadata.createdAt': -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    PersonModel.countDocuments(filter),
  ]);
  return { total, limit, offset, persons };
}

async function callVisionBlur(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${VISION_SERVICE_URL}/blur-faces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, '[lopnna] Vision blur service error');
      return null;
    }

    const result = await response.json();
    if (!result.image_base64) {
      logger.warn('[lopnna] No blurred image returned');
      return null;
    }

    return result.image_base64;
  } catch (error: any) {
    logger.warn({ err: error }, '[lopnna] Error calling vision blur service');
    return null;
  }
}

export async function blurPersonFaces(idHash: string, actor: string, req: Request) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) return { status: 404, error: 'Persona no encontrada' };
  if (!person.photoUrl) return { status: 400, error: 'La persona no tiene foto' };

  let imageUrl = person.photoUrl;
  if (imageUrl.startsWith('/api/media/')) {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://api:4000';
    imageUrl = `${apiBaseUrl}${imageUrl}`;
  }

  const base64 = await callVisionBlur(imageUrl);
  if (!base64) return { status: 502, error: 'Error al difuminar rostros en el servicio de visión' };

  const buffer = Buffer.from(base64, 'base64');
  const blurredUrl = await uploadMedia(buffer, `blurred-${idHash}.jpg`, 'image/jpeg');

  person.photoUrl = blurredUrl;
  person.metadata.auditStatus = 'clean';
  person.metadata.containsMinor = false;
  person.metadata.containsMinorAges = [];
  person.metadata.updatedAt = new Date();
  await person.save();

  auditLog({
    eventType: 'admin_action',
    severity: 'warning',
    actor,
    action: 'LOPNNA_BLUR_FACES',
    resource: idHash,
    detail: { message: 'Rostros difuminados por protección de menores' },
    req,
  });

  return { status: 200, data: { message: 'Rostros difuminados exitosamente', photoUrl: blurredUrl } };
}

export async function deletePersonPhoto(idHash: string, actor: string, req: Request) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) return { status: 404, error: 'Persona no encontrada' };

  person.photoUrl = undefined;
  person.metadata.auditStatus = 'clean';
  person.metadata.containsMinor = false;
  person.metadata.containsMinorAges = [];
  person.metadata.updatedAt = new Date();
  await person.save();

  auditLog({
    eventType: 'admin_action',
    severity: 'warning',
    actor,
    action: 'LOPNNA_DELETE_PHOTO',
    resource: idHash,
    detail: { message: 'Foto eliminada por protección de menores' },
    req,
  });

  return { status: 200, data: { message: 'Foto eliminada, datos del familiar intactos' } };
}

export async function resolveFalsePositive(idHash: string, actor: string, req: Request) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) return { status: 404, error: 'Persona no encontrada' };

  person.metadata.auditStatus = 'clean';
  person.metadata.containsMinor = false;
  person.metadata.containsMinorAges = [];
  person.metadata.updatedAt = new Date();
  await person.save();

  auditLog({
    eventType: 'admin_action',
    severity: 'info',
    actor,
    action: 'LOPNNA_FALSE_POSITIVE',
    resource: idHash,
    detail: { message: 'Falso positivo de menor — foto aprobada por admin' },
    req,
  });

  return { status: 200, data: { message: 'Foto aprobada como falso positivo' } };
}
