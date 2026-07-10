import { Router, Request, Response, NextFunction } from 'express';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { upsertPerson } from '../services/person.service';
import { PersonModel } from '../models/unified-person.model';
import { adminStatusUpdateSchema, adminMergeSchema } from '../validators/admin.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { UserModel } from '../models/user.model';
import { MatchModel } from '../models/match.model';
import { SearchRequestModel } from '../models/search-request.model';

const router = Router();

// Endpoint de Fusión (Merge) Atómica
router.post('/merge/:id1/:id2', async (req: Request, res: Response) => {
  try {
    const { id1, id2 } = req.params;
    
    // 1. Fetch both persons
    const person1 = await PersonModel.findOne({ idHash: id1 });
    const person2 = await PersonModel.findOne({ idHash: id2 });

    if (!person1 || !person2) {
      return res.status(404).json({ error: 'Uno o ambos reportes no fueron encontrados' });
    }

    // 2. Trazabilidad: Snapshot
    const snapshot = {
      p1: { id: person1.idHash, name: person1.name, status: person1.status, origen: person1.data?.origen },
      p2: { id: person2.idHash, name: person2.name, status: person2.status, origen: person2.data?.origen }
    };

    // 3. Update Person 1 (absorbs data)
    person1.status = 'found'; // Case closed conceptually
    if (person2.lastSeen && !person1.lastSeen?.coordinates) {
      person1.lastSeen = person2.lastSeen;
    }
    // Merge external IDs
    person1.externalIds = [...person1.externalIds, ...person2.externalIds];
    
    // Update Person 2 (mark as merged)
    person2.metadata.auditStatus = 'merged';

    // 4. Save both (Simulate Atomicity without Transactions since ReplicaSet might not be active)
    await person1.save();
    await person2.save();

    // 5. Auditoría Forense Obligatoria
    auditLog({
      eventType: 'admin_action',
      severity: 'warning',
      actor: (req as any).user?.userId || 'admin',
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
    console.error('[AdminRoute] POST /merge Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint para listar posibles duplicados
router.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
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
});

// Endpoint para fusionar registros (confirmar que son la misma persona)
router.post('/audit/:jobId/merge', async (req: Request, res: Response, next: NextFunction) => {
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
    
    const existingPerson = await PersonModel.findOne({ idHash: targetIdHash });
    
    if (!existingPerson) {
       return res.status(404).json({ error: 'Target person not found in database' });
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
      actor: (req as any).user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/merge',
      resource: targetIdHash,
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'merged', idHash: mergedPerson.idHash });
  } catch (error) {
    next(error);
  }
});

// Endpoint para descartar (son personas diferentes, insertar como nuevo)
router.post('/audit/:jobId/dismiss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.jobId as string;

    const job = await manualAuditQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in queue' });
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
      actor: (req as any).user?.userId || 'admin',
      action: 'POST /admin/audit/:jobId/dismiss',
      detail: { jobId },
      req,
    });

    return res.status(200).json({ status: 'inserted_as_new', idHash: newPerson.idHash });
  } catch (error) {
    next(error);
  }
});

// Cambiar estado de una persona (missing <-> found)
router.patch('/persons/:idHash/status', async (req: Request, res: Response, next: NextFunction) => {
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
    next(error);
  }
});

// Aprobar o rechazar reporte en moderación
router.patch('/persons/:idHash/moderate', async (req: Request, res: Response) => {
  try {
    const { idHash } = req.params;
    const { action } = req.body; // 'approve' | 'reject'

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
    console.error('[AdminRoute] PATCH /persons/:idHash/moderate Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Editar datos completos de un registro (Admin)
router.put('/persons/:idHash', async (req: Request, res: Response) => {
  try {
    const { idHash } = req.params;
    const { 
      name, type, status, aliases, age, gender, 
      description, state, municipality, date,
      contactPerson
    } = req.body;

    const person = await PersonModel.findOne({ idHash });
    if (!person) return res.status(404).json({ error: 'Persona no encontrada' });

    if (name !== undefined) person.name = name;
    if (type !== undefined) person.type = type;
    if (status !== undefined) person.status = status;
    if (aliases !== undefined) person.aliases = Array.isArray(aliases) ? aliases : aliases.split(',').map((s:string)=>s.trim()).filter(Boolean);
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
    console.error('[AdminRoute] PUT /persons/:idHash Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Obtener historial de chat para un reporte específico
router.get('/persons/:idHash/contacts', async (req: Request, res: Response) => {
  try {
    const { idHash } = req.params;
    // Asumiendo que CaseContactModel está registrado o podemos usar Mongoose mongoose.model('CaseContact')
    const mongoose = require('mongoose');
    const ContactModel = mongoose.model('CaseContact');
    
    const messages = await ContactModel.find({ reportId: idHash }).sort({ createdAt: 1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    console.error('[AdminRoute] GET /persons/:idHash/contacts Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Gestión de Registros (Personas) ──
router.get('/persons', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    const { auditStatus } = req.query;
    
    const filter: any = {};
    if (auditStatus) {
      filter['metadata.auditStatus'] = auditStatus;
    }

    const persons = await PersonModel.find(filter)
      .populate('metadata.reportedBy', 'name email')
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit)
      .lean();
    return res.status(200).json(persons);
  } catch (error) {
    console.error('[AdminRoute] GET /persons Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Gestión de Matches IA ──
router.get('/matches', async (req: Request, res: Response) => {
  try {
    const matches = await MatchModel.find({ status: { $in: ['posible', 'probable', 'revisar'] } })
      .sort({ score: -1 })
      .populate({ path: 'person', strictPopulate: false })
      .populate({ path: 'matchedPerson', strictPopulate: false })
      .populate('searchRequestId');
    return res.status(200).json(matches);
  } catch (error) {
    console.error('[AdminRoute] GET /matches Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/matches/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const match = await MatchModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!match) return res.status(404).json({ error: 'Match no encontrado' });

    auditLog({
      eventType: 'admin_action',
      severity: 'info',
      actor: (req as any).user?.userId || 'admin',
      action: 'PATCH /admin/matches/:id/status',
      resource: id as string,
      detail: { newStatus: status },
      req,
    });

    return res.status(200).json(match);
  } catch (error) {
    console.error('[AdminRoute] PATCH /matches/:id/status Error:', error);
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
      resource: id as string,
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
      resource: id as string,
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
// ── Búsquedas Manuales (Familiares) ──
router.get('/searches', async (req: Request, res: Response) => {
  try {
    const searches = await SearchRequestModel.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    return res.status(200).json(searches);
  } catch (error) {
    console.error('[AdminRoute] GET /searches Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const adminRouter = router;
