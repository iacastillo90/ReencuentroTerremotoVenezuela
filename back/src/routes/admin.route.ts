import { Router, Request, Response } from 'express';
import { manualAuditQueue } from '../queues/manual-audit.queue';
import { upsertPerson } from '../services/person.service';
import { PersonModel } from '../models/unified-person.model';

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
    const { targetIdHash } = req.body; // El ID de la persona existente en BD

    if (!targetIdHash) {
      return res.status(400).json({ error: 'Missing targetIdHash' });
    }

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

    return res.status(200).json({ status: 'inserted_as_new', idHash: newPerson.idHash });
  } catch (error) {
    console.error('[AdminRoute] POST /audit/:jobId/dismiss Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const adminRouter = router;
