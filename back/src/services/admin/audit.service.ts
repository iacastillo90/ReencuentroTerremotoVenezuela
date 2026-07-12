import { manualAuditQueue } from '../../queues/manual-audit.queue';
import { PersonModel } from '../../models/unified-person.model';
import { upsertPerson } from '../person.service';
import { auditLog } from '../../middlewares/audit.middleware';
import type { Request } from 'express';

export async function getAuditJobs() {
  const jobs = await manualAuditQueue.getWaiting();
  return jobs.map(job => ({
    jobId: job.id,
    incoming: job.data.incoming,
    candidates: job.data.candidates,
    timestamp: job.timestamp
  }));
}

export async function mergeAuditJob(jobId: string, targetIdHash: string, actor: string, req: Request) {
  const job = await manualAuditQueue.getJob(jobId);
  if (!job) {
    return { status: 404, error: 'Trabajo no encontrado en la cola' };
  }

  const { incoming } = job.data;

  const existingPerson = await PersonModel.findOne({ idHash: targetIdHash });
  if (!existingPerson) {
    return { status: 404, error: 'Persona destino no encontrada en la base de datos' };
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
    actor,
    action: 'POST /admin/audit/:jobId/merge',
    resource: targetIdHash,
    detail: { jobId },
    req,
  });

  return { status: 200, data: { status: 'merged', idHash: mergedPerson.idHash } };
}

export async function dismissAuditJob(jobId: string, actor: string, req: Request) {
  const job = await manualAuditQueue.getJob(jobId);
  if (!job) {
    return { status: 404, error: 'Trabajo no encontrado en la cola' };
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
    actor,
    action: 'POST /admin/audit/:jobId/dismiss',
    detail: { jobId },
    req,
  });

  return { status: 200, data: { status: 'inserted_as_new', idHash: newPerson.idHash } };
}
