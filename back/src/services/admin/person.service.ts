/**
 * services/admin/person.service — Gestión administrativa de personas
 *
 * PROPÓSITO:
 *   Provee operaciones CRUD administrativas sobre personas: fusión de
 *   perfiles, consulta, actualización de estado, moderación y contactos.
 *
 * CARACTERÍSTICAS:
 *   - mergeProfiles: fusiona dos perfiles usando transacciones MongoDB
 *   - getAdminPersons: consulta paginada con filtros
 *   - putPerson: actualización parcial de campos
 *   - updatePersonStatus: cambia estado (missing/found/deceased)
 *   - moderatePerson: aprueba o rechaza (elimina) un reporte
 *   - getPersonContacts: consulta mensajes de contacto
 *   - Audit logging con snapshot de cambios en merges
 *
 * @module person.service
 */

import mongoose from 'mongoose';
import { PersonModel } from '../../models/unified-person.model';
import { AuditLogModel } from '../../models/audit-log.model';
import { MatchModel } from '../../models/match.model';
import { auditLog } from '../../middlewares/audit.middleware';
import type { Request } from 'express';

export async function mergeProfiles(id1: string, id2: string, actor: string, req: Request) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const person1 = await PersonModel.findOne({ idHash: id1 }).session(session);
    const person2 = await PersonModel.findOne({ idHash: id2 }).session(session);

    if (!person1 || !person2) {
      await session.abortTransaction();
      return { status: 404, error: 'Uno o ambos reportes no fueron encontrados' };
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
      actor,
      action: 'MERGE_PROFILES',
      resource: `${id1}_${id2}`,
      detail: {
        targetIds: [id1, id2],
        changes: JSON.stringify(snapshot).substring(0, 1900)
      },
      req,
    });

    return { status: 200, data: { status: 'success', message: 'Perfiles fusionados correctamente' } };
  } finally {
    await session.endSession().catch(() => {});
  }
}

export async function getAdminPersons(filter: Record<string, any>, limit: number, offset: number) {
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

export async function putPerson(idHash: string, data: Record<string, any>) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) return { status: 404, error: 'Persona no encontrada' };

  const { name, type, status, aliases, age, gender, description, state, municipality, date, contactPerson } = data;

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

  return { status: 200, data: person };
}

export async function updatePersonStatus(idHash: string, status: string, actor: string, req: Request) {
  const updated = await PersonModel.findOneAndUpdate(
    { idHash },
    { status, 'metadata.updatedAt': new Date() },
    { returnDocument: 'after' }
  );

  if (!updated) return { status: 404, error: 'Persona no encontrada' };

  auditLog({
    eventType: 'admin_action',
    severity: 'info',
    actor,
    action: 'PATCH /admin/persons/:idHash/status',
    resource: idHash,
    detail: { newStatus: status },
    req,
  });

  return { status: 200, data: { status: updated.status, idHash: updated.idHash } };
}

export async function moderatePerson(idHash: string, action: string) {
  if (action === 'reject') {
    const deleted = await PersonModel.findOneAndDelete({ idHash });
    if (!deleted) return { status: 404, error: 'Persona no encontrada' };
    return { status: 200, data: { message: 'Reporte rechazado y eliminado' } };
  }

  const updated = await PersonModel.findOneAndUpdate(
    { idHash },
    { 'metadata.auditStatus': 'clean', 'metadata.updatedAt': new Date() },
    { returnDocument: 'after' }
  );
  if (!updated) return { status: 404, error: 'Persona no encontrada' };
  return { status: 200, data: updated };
}

export async function getPersonContacts(idHash: string) {
  const mongoose = require('mongoose');
  const ContactModel = mongoose.model('CaseContact');
  const messages = await ContactModel.find({ reportId: idHash }).sort({ createdAt: 1 }).lean();
  return messages;
}

export async function deleteAdminPerson(idHash: string, adminId: string, req: any) {
  const person = await PersonModel.findOne({ idHash });
  if (!person) return { status: 404, error: 'Persona no encontrada' };

  await PersonModel.deleteOne({ idHash });

  await AuditLogModel.create({
    eventType: 'admin_action',
    severity: 'critical',
    actor: adminId,
    action: `Deleted person ${idHash}`,
    detail: { name: person.name, externalIds: person.externalIds },
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent']
  });

  return { status: 200, data: { status: 'success', message: 'Registro eliminado exitosamente' } };
}
