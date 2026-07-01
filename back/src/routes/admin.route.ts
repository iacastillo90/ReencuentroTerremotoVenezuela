import { Router, Request, Response } from 'express';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { upsertPerson } from '../services/person.service';
import { PersonModel } from '../models/unified-person.model';
import { adminStatusUpdateSchema, adminMergeSchema } from '../validators/admin.validator';
import { auditLog } from '../middlewares/audit.middleware';

const router = Router();

// Endpoint para listar posibles duplicados
router.get('/audit', async (req: Request, res: Response) => {
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
    console.error('[AdminRoute] GET /audit Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para fusionar registros (confirmar que son la misma persona)
router.post('/audit/:jobId/merge', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;

    const validation = adminMergeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { targetIdHash } = validation.data;

    const job = await manualAuditQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in queue' });
    }

    const { incoming } = job.data;
    
    // Buscar la persona original para mantener su nombre y preservar el idHash
    const existingPerson = await PersonModel.findOne({ idHash: targetIdHash });
    
    if (!existingPerson) {
       return res.status(404).json({ error: 'Target person not found in database' });
    }

    // Unificar usando los datos entrantes pero reteniendo las llaves maestras del registro previo
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

    await job.remove(); // Sacarlo de la cola

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: (req as any).user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/merge',
      resource: targetIdHash,
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'merged', idHash: mergedPerson.idHash });
  } catch (error) {
    console.error('[AdminRoute] POST /audit/:jobId/merge Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para descartar (son personas diferentes, insertar como nuevo)
router.post('/audit/:jobId/dismiss', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;

    const job = await manualAuditQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in queue' });
    }

    const { incoming } = job.data;

    // Forzamos inserción como un nuevo registro
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

    await job.remove(); // Sacarlo de la cola

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: (req as any).user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/dismiss',
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'inserted_as_new', idHash: newPerson.idHash });
  } catch (error) {
    console.error('[AdminRoute] POST /audit/:jobId/dismiss Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cambiar estado de una persona (missing <-> found)
router.patch('/persons/:idHash/status', async (req: Request, res: Response) => {
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
      actor: (req as any).user?.userId || 'admin',
      action: 'PATCH /admin/persons/:idHash/status',
      resource: idHash as string,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json({ status: updated.status, idHash: updated.idHash });
  } catch (error) {
    console.error('[AdminRoute] PATCH /persons/:idHash/status Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
// ── Gestión de Usuarios ──
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await UserModel.find({}, '-passwordHash').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    console.error('[AdminRoute] GET /users Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/users/:id/role', async (req: Request, res: Response) => {
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
      actor: (req as any).user?.userId || 'admin',
      action: 'PATCH /admin/users/:id/role',
      resource: id,
      detail: { newRole: role },
      req,
    });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/users/:id/status', async (req: Request, res: Response) => {
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
      actor: (req as any).user?.userId || 'admin',
      action: 'PATCH /admin/users/:id/status',
      resource: id,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mock verifications endpoint just to satisfy the frontend for now
router.get('/verifications', async (req: Request, res: Response) => {
  return res.status(200).json([]);
});
export const adminRouter = router;
