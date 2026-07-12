import { Request, Response, NextFunction } from 'express';

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v ?? '');
}
import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';
import { adminStatusUpdateSchema, adminMergeSchema } from '../validators/admin.validator';
import { mergeProfiles, getAdminPersons, putPerson, updatePersonStatus, moderatePerson, getPersonContacts } from '../services/admin/person.service';
import { getAuditJobs, mergeAuditJob, dismissAuditJob } from '../services/admin/audit.service';
import { getAdminMatches, updateMatchStatus } from '../services/admin/match.service';
import { getAdminUsers, updateUserRole, updateUserStatus, getVerifications } from '../services/admin/user.service';
import { getAdminSearches } from '../services/admin/search.service';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key.service';

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
    const { action } = req.body;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Acción inválida' });
    }
    const result = await moderatePerson(asString(req.params.idHash), action);
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
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const filter: Record<string, any> = {};
    if (req.query.auditStatus) {
      filter['metadata.auditStatus'] = req.query.auditStatus;
    }
    const result = await getAdminPersons(filter, limit, offset);
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
    const { status } = req.body;
    const result = await updateMatchStatus(asString(req.params.id), status, req.user?.userId || 'admin', req);
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
    const { role } = req.body;
    const result = await updateUserRole(asString(req.params.id), role, req.user?.userId || 'admin', req);
    return res.status(result.status).json(result.error ? { error: result.error } : result.data);
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.body;
    const result = await updateUserStatus(asString(req.params.id), status, req.user?.userId || 'admin', req);
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
