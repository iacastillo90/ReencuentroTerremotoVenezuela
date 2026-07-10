import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SearchRequestModel } from '../models/search-request.model';
import { requireUser } from '../middlewares/auth.middleware';
import { ValidationError } from '../middlewares/error.middleware';
import { personMatchingQueue } from '../queues/person-matching.queue';

const createSearchRequestSchema = z.object({
  searchName: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  category: z.enum(['menor', 'adulto', 'adulto_mayor', 'mascota']).optional(),
  isMinor: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['activa', 'resuelta', 'cancelada']),
});

const router = Router();

// Crear una solicitud de búsqueda (crear alerta)
router.post('/', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    const parsed = createSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Datos de solicitud inválidos', { errors: parsed.error.issues }));
    }
    const { searchName, description, category, isMinor } = parsed.data;

    const newRequest = await SearchRequestModel.create({
      user: userId,
      searchName,
      description,
      category,
      isMinor
    });

    await personMatchingQueue.enqueue({ idHash: newRequest._id.toString(), source: 'search-request' });

    return res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
});

// Listar solicitudes del usuario
router.get('/mine', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const requests = await SearchRequestModel.find({ user: userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
});

// Cancelar/resolver una solicitud
router.patch('/:id/status', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Estado inválido', { errors: parsed.error.issues }));
    }
    const { status } = parsed.data;

    const request = await SearchRequestModel.findOneAndUpdate(
      { _id: id, user: userId },
      { status },
      { new: true }
    );

    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    return res.status(200).json(request);
  } catch (error) {
    next(error);
  }
});

export const searchRequestRouter = router;
