import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { personPayloadSchema } from '../validators/person.validator';
import * as personService from '../services/person.service';
import { ValidationError } from '../middlewares/error.middleware';

const closeCaseSchema = z.object({
  resolution: z.enum(['found', 'deceased', 'erroneous']),
  notes: z.string().max(2000).optional(),
});

export async function getCounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await personService.getCounts();
    return res.status(200).json(counts);
  } catch (error) {
    next(error);
  }
}

export async function getMyReports(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await personService.getMyReports(userId, limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPersons(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as Record<string, any>;
    const { limit = 50, offset = 0 } = query;
    const viewerRole = req.user?.role;

    const result = await personService.getPersons({
      q: query.q,
      status: query.status,
      category: query.category,
      state: query.state,
      municipality: query.municipality,
      limit,
      offset,
      viewerRole,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createPerson(req: Request, res: Response, next: NextFunction) {
  try {
    const validationResult = personPayloadSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Error de validación',
        details: validationResult.error.issues
      });
    }

    const payload = validationResult.data;
    const userId = payload.isAnonymous ? undefined : req.user?.userId as string;
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';

    const result = await personService.createPerson(payload, userId, ip);
    return res.status(result.status === 'skipped' ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function closeCase(req: Request, res: Response, next: NextFunction) {
  try {
    const idHash = req.params.idHash as string;
    const userId = req.user!.userId as string;
    const userRole = req.user!.role || 'user';

    const parsed = closeCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Resolución inválida', { errors: parsed.error.issues }));
    }

    const { resolution, notes } = parsed.data;
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown';

    const result = await personService.closeCase(idHash, userId, userRole, resolution, notes, ip, userAgent);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
