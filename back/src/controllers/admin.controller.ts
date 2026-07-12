import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { upsertPerson } from '../services/person.service';
import { PersonModel } from '../models/unified-person.model';
import { adminStatusUpdateSchema, adminMergeSchema } from '../validators/admin.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { UserModel } from '../models/user.model';
import { MatchModel } from '../models/match.model';
import { SearchRequestModel } from '../models/search-request.model';
import { sanitizedString } from '../utils/sanitize.util';

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

export async function mergeProfiles(req: Request, res: Response, next: NextFunction) {
  const session = await mongoose.startSession();
  try {
    const { id1, id2 } = req.params;

    session.startTransaction();

    const person1 = await PersonModel.findOne({ idHash: id1 }).session(session);
    const person2 = await PersonModel.findOne({ idHash: id2 }).session(session);

    if (!person1 || !person2) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Uno o ambos reportes no fueron encontrados' });
    }

    const snapshot = {
      p1: { id: person1.idHash, name: person1.name, status: person1.status, origen: person1.data?.origen },
      p2: { id: person2.idHash, name: person2.name, status: person2.status, origen: person2.data?.origen }
    };

    person1.status = 'found';
    if (person2.lastSeen && !person1.lastSeen?.coordinates) {
      person1.lastSeen = person2.lastSeen;
    }
    person1.externalIds = [...person1.externalIds, ...person2.externalIds];

    person2.metadata.auditStatus = 'merged';

    await person1.save({ session });
    await person2.save({ session });

    await session.commitTransaction();

    auditLog({
      eventType: 'admin_action',
      severity: 'warning',
      actor: req.user?.userId || 'admin',
      action: 'MERGE_PROFILES',
      resource: `${id1}_${id2}`,
      detail: {
        targetIds: [id1, id2],
        changes: JSON.stringify(snapshot).substring(0, 1900)
      },
      req,
    });

    return res.status(200).json({ status: 'success', message: 'Perfiles fusionados correctamente' });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    next(error);
  } finally {
    await session.endSession().catch(() => {});
  }
}

export async function getAuditJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await manualAuditQueue.getWaiting();
    const formattedJobs = jobs.map(job => ({
      jobId: job.id,
      incoming: job.data.incoming,
      candidates: job.data.candidates,
      timestamp: job.timestamp
    }));

    return res.status(200).json(formattedJobs);
  } catch (error) {
    next(error);
  }
}

export async function mergeAuditJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId as string;

    const validation = adminMergeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { targetIdHash } = validation.data;

    const job = await manualAuditQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Trabajo no encontrado en la cola' });
    }

    const { incoming } = job.data;

    const existingPerson = await PersonModel.findOne({ idHash: targetIdHash });

    if (!existingPerson) {
       return res.status(404).json({ error: 'Persona destino no encontrada en la base de datos' });
    }

    const mergedPerson = await upsertPerson(
      incoming.source,
      incoming.externalId,
      {
        ...incoming.personData,
        normalizedName: existingPerson.normalizedName,
        name: existingPerson.name,
        age: existingPerson.age,
        metadata: {
          ...incoming.personData.metadata,
          auditStatus: 'merged'
        }
      }
    );

    await job.remove();

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/merge',
      resource: targetIdHash,
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'merged', idHash: mergedPerson.idHash });
  } catch (error) {
    next(error);
  }
}

export async function dismissAuditJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId as string;

    const job = await manualAuditQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Trabajo no encontrado en la cola' });
    }

    const { incoming } = job.data;

    const newPerson = await upsertPerson(
      incoming.source,
      incoming.externalId,
      {
        ...incoming.personData,
        metadata: {
          ...incoming.personData.metadata,
          auditStatus: 'clean'
        }
      }
    );

    await job.remove();

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/dismiss',
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'inserted_as_new', idHash: newPerson.idHash });
  } catch (error) {
    next(error);
  }
}

export async function updatePersonStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { idHash } = req.params;

    const validation = adminStatusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Estado inválido', details: validation.error.issues });
    }

    const { status } = validation.data;

    const updated = await PersonModel.findOneAndUpdate(
      { idHash },
      { status, 'metadata.updatedAt': new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'PATCH /admin/persons/:idHash/status',
      resource: idHash as string,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json({ status: updated.status, idHash: updated.idHash });
  } catch (error) {
    next(error);
  }
}

export async function moderatePerson(req: Request, res: Response, next: NextFunction) {
  try {
    const { idHash } = req.params;
    const { action } = req.body;

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Acción inválida' });
    }

    if (action === 'reject') {
      const deleted = await PersonModel.findOneAndDelete({ idHash });
      if (!deleted) return res.status(404).json({ error: 'Persona no encontrada' });
      return res.status(200).json({ message: 'Reporte rechazado y eliminado' });
    } else {
      const updated = await PersonModel.findOneAndUpdate(
        { idHash },
        { 'metadata.auditStatus': 'clean', 'metadata.updatedAt': new Date() },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Persona no encontrada' });
      return res.status(200).json(updated);
    }
  } catch (error) {
    next(error);
  }
}

export async function putPerson(req: Request, res: Response, next: NextFunction) {
  try {
    const { idHash } = req.params;

    const parseResult = adminPutPersonSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Error de validación', details: parseResult.error.issues });
    }

    const { name, type, status, aliases, age, gender, description, state, municipality, date, contactPerson } = parseResult.data;

    const person = await PersonModel.findOne({ idHash });
    if (!person) return res.status(404).json({ error: 'Persona no encontrada' });

    if (name !== undefined) person.name = name;
    if (type !== undefined) person.type = type;
    if (status !== undefined) person.status = status;
    if (aliases !== undefined) person.aliases = Array.isArray(aliases) ? aliases : aliases.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (age !== undefined) person.age = age;
    if (gender !== undefined) person.gender = gender;

    if (!person.lastSeen) person.lastSeen = { description: '', state: '', date: new Date() };
    if (description !== undefined) person.lastSeen.description = description;
    if (state !== undefined) person.lastSeen.state = state;
    if (municipality !== undefined) person.lastSeen.municipality = municipality;
    if (date !== undefined) person.lastSeen.date = new Date(date);

    if (contactPerson !== undefined) person.contactPerson = contactPerson;

    person.metadata.updatedAt = new Date();
    await person.save();

    return res.status(200).json(person);
  } catch (error) {
    next(error);
  }
}

export async function getPersonContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { idHash } = req.params;
    const mongoose = require('mongoose');
    const ContactModel = mongoose.model('CaseContact');

    const messages = await ContactModel.find({ reportId: idHash }).sort({ createdAt: 1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
}

export async function getAdminPersons(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const { auditStatus } = req.query;

    const filter: any = {};
    if (auditStatus) {
      filter['metadata.auditStatus'] = auditStatus;
    }

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
    return res.status(200).json({ total, limit, offset, persons });
  } catch (error) {
    next(error);
  }
}

export async function getAdminMatches(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const countResult = await MatchModel.countDocuments({ status: { $in: ['posible', 'probable', 'revisar'] } });

    const matches = await MatchModel.aggregate([
      { $match: { status: { $in: ['posible', 'probable', 'revisar'] } } },
      { $sort: { score: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'unifiedpersons',
          localField: 'person',
          foreignField: '_id',
          as: 'person'
        }
      },
      { $unwind: { path: '$person', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'unifiedpersons',
          localField: 'matchedPerson',
          foreignField: '_id',
          as: 'matchedPerson'
        }
      },
      { $unwind: { path: '$matchedPerson', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'searchrequests',
          localField: 'searchRequestId',
          foreignField: '_id',
          as: 'searchRequestId'
        }
      },
      { $unwind: { path: '$searchRequestId', preserveNullAndEmptyArrays: true } },
    ]);
    return res.status(200).json({ data: matches, total: countResult, limit, offset });
  } catch (error) {
    next(error);
  }
}

export async function updateMatchStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const match = await MatchModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!match) return res.status(404).json({ error: 'Coincidencia no encontrada' });

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'PATCH /admin/matches/:id/status',
      resource: id as string,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json(match);
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const [users, total] = await Promise.all([
      UserModel.find({}, '-passwordHash').sort({ createdAt: -1 }).skip(offset).limit(limit),
      UserModel.countDocuments({}),
    ]);
    return res.status(200).json({ total, limit, offset, users });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'verifier', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const user = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'PATCH /admin/users/:id/role',
      resource: id as string,
      detail: { newRole: role },
      req,
    });

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const user = await UserModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: req.user?.userId || 'admin',
      action: 'PATCH /admin/users/:id/status',
      resource: id as string,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

export async function getVerifications(_req: Request, res: Response) {
  return res.status(200).json([]);
}

export async function getAdminSearches(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const [searches, total] = await Promise.all([
      SearchRequestModel.find({})
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      SearchRequestModel.countDocuments({}),
    ]);
    return res.status(200).json({ total, limit, offset, searches });
  } catch (error) {
    next(error);
  }
}

import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key.service';

export async function postApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = z.object({ name: z.string(), type: z.enum(['admin', 'webhook', 'partner']) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const { name, type } = parsed.data;
    const result = await createApiKey(name, type);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getApiKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const keys = await listApiKeys(type);
    return res.status(200).json(keys);
  } catch (error) {
    next(error);
  }
}

export async function deleteApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const ok = await revokeApiKey(id);
    if (!ok) {
      return res.status(404).json({ error: 'Clave API no encontrada' });
    }
    return res.status(200).json({ message: 'Clave API revocada' });
  } catch (error) {
    next(error);
  }
}
