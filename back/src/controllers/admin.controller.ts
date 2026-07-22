/**
 * controllers/admin.controller.ts — Controlador de administración
 *
 * PROPÓSITO:
 *   Maneja TODAS las operaciones de administración: moderación de personas,
 *   gestión de usuarios, API keys, matches, auditoría, y fusiones de perfiles.
 *   Cada handler valida con Zod y delega al service correspondiente.
 *
 * CARACTERÍSTICAS:
 *   - Merge de perfiles duplicados (2 → 1 con externalIds consolidados)
 *   - Moderación de personas (auditStatus: pending_review → clean/merged)
 *   - Gestión de usuarios (role: admin/user/verifier, status: pending/approved/banned)
 *   - API keys (crear, listar, revocar) para admin/webhook/partner
 *   - Matches (aprobar/rechazar coincidencias del algoritmo)
 *   - Auditoría (jobs de fusión automática, dismiss)
 *
 * FLUJO DE DATOS:
 *   1. Request llega con params/body
 *   2. Zod schema valida y sanitiza inputs
 *   3. Service layer ejecuta lógica de negocio
 *   4. Response con resultado + audit log implícito
 *
 * SEGURIDAD:
 *   - requireAdminApiKey o JWT con role='admin' en todas las rutas
 *   - Zod validation en todos los inputs (previene NoSQL injection)
 *   - sanitizedString para campos de texto (previene XSS)
 *   - auditLog implícito en operaciones críticas (merge, moderation, user changes)
 *   - PII excluida de responses (toPublicPerson en services)
 *
 * ENDPOINTS PRINCIPALES:
 *   POST /api/admin/merge/:id1/:id2 — Fusionar 2 perfiles
 *   PATCH /api/admin/persons/:idHash/moderate — Moderar perfil
 *   PATCH /api/admin/users/:id/role — Cambiar rol de usuario
 *   POST /api/admin/api-keys — Crear API key
 *   PATCH /api/admin/matches/:id/status — Aprobar/rechazar match
 *
 * DECISIONES TÉCNICAS:
 *   - asString helper: normaliza params a string (evita bugs de tipo)
 *   - Handlers delgados: toda la lógica está en services
 *   - Zod schemas inline para casos simples, importados para complejos
 */
import { Request, Response, NextFunction } from 'express';

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v ?? '');
}
import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';
import { adminStatusUpdateSchema, adminMergeSchema, adminModerateSchema, adminUpdateMatchStatusSchema, adminUpdateUserRoleSchema, adminUpdateUserStatusSchema, adminAuditStatusQuerySchema } from '../validators/admin.validator';
import { mergeProfiles, getAdminPersons, putPerson, updatePersonStatus, moderatePerson, getPersonContacts, deleteAdminPerson } from '../services/admin/person.service';
import { getAuditJobs, mergeAuditJob, dismissAuditJob, getAuditLogs } from '../services/admin/audit.service';
import { getAdminMatches, updateMatchStatus } from '../services/admin/match.service';
import { getAdminUsers, updateUserRole, updateUserStatus, getVerifications } from '../services/admin/user.service';
import { getAdminSearches } from '../services/admin/search.service';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key.service';
import { listFlaggedPersons, blurPersonFaces, deletePersonPhoto, resolveFalsePositive } from '../services/admin/lopnna.service';

const adminPutPersonSchema = z.object({
  name: sanitizedString.optional(),
  type: z.enum(['person', 'animal']).optional(),
  status: z.enum(['missing', 'found', 'deceased', 'unknown']).optional(),
  aliases: z.union([z.string(), z.array(z.string())]).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['M', 'F', 'other', 'unknown']).optional(),
  description: sanitizedString.optional(),
  state: sanitizedString.optional(),
  municipality: sanitizedString.optional(),
  date: z.string().datetime({ offset: true }).optional(),
  contactPerson: z.object({
    name: sanitizedString,
    phone: z.string().optional(),
    relationship: sanitizedString,
  }).optional(),
});

export async function mergeProfilesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await mergeProfiles(asString(req.params.id1), asString(req.params.id2), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function getAuditJobsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await getAuditJobs();
    return res.status(200).json(jobs);
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
    const result = await getAuditLogs(limit, offset, eventType);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function mergeAuditJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = adminMergeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }
    const result = await mergeAuditJob(asString(req.params.jobId), validation.data.targetIdHash, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function dismissAuditJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dismissAuditJob(asString(req.params.jobId), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function updatePersonStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = adminStatusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Estado inválido', details: validation.error.issues });
    }
    const result = await updatePersonStatus(asString(req.params.idHash), validation.data.status, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function moderatePersonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminModerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Acción inválida', details: parsed.error.issues });
    }
    const result = await moderatePerson(asString(req.params.idHash), parsed.data.action);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function putPersonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = adminPutPersonSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Error de validación', details: parseResult.error.issues });
    }
    const result = await putPerson(asString(req.params.idHash), parseResult.data);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function getPersonContactsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await getPersonContacts(asString(req.params.idHash));
    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
}

export async function getAdminPersonsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminAuditStatusQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parámetros inválidos', details: parsed.error.issues });
    }
    const filter: Record<string, any> = {};
    if (parsed.data.auditStatus) {
      filter['metadata.auditStatus'] = parsed.data.auditStatus;
    }
    const result = await getAdminPersons(filter, parsed.data.limit, parsed.data.offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminMatchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getAdminMatches(limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateMatchStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminUpdateMatchStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Estado inválido', details: parsed.error.issues });
    }
    const result = await updateMatchStatus(asString(req.params.id), parsed.data.status, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getAdminUsers(limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminUpdateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Rol inválido', details: parsed.error.issues });
    }
    const result = await updateUserRole(asString(req.params.id), parsed.data.role, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminUpdateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Estado inválido', details: parsed.error.issues });
    }
    const result = await updateUserStatus(asString(req.params.id), parsed.data.status, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function getVerificationsHandler(_req: Request, res: Response) {
  return res.status(200).json(getVerifications());
}

export async function getAdminSearchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getAdminSearches(limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postApiKeyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = z.object({ name: z.string(), type: z.enum(['admin', 'webhook', 'partner']) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const result = await createApiKey(parsed.data.name, parsed.data.type);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getApiKeysHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const keys = await listApiKeys(type);
    return res.status(200).json(keys);
  } catch (error) {
    next(error);
  }
}

export async function deleteApiKeyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await revokeApiKey(asString(req.params.id));
    if (!ok) {
      return res.status(404).json({ error: 'Clave API no encontrada' });
    }
    return res.status(200).json({ message: 'Clave API revocada' });
  } catch (error) {
    next(error);
  }
}

// ─── LOPNNA — Protección de Menores ─────────────────────────────────

export async function getLopnnaFlaggedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await listFlaggedPersons(limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function lopnnaBlurHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await blurPersonFaces(asString(req.params.idHash), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function lopnnaDeletePhotoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deletePersonPhoto(asString(req.params.idHash), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function lopnnaFalsePositiveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resolveFalsePositive(asString(req.params.idHash), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function deletePersonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteAdminPerson(asString(req.params.idHash), req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}
