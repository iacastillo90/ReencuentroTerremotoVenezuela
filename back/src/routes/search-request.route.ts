import { Router, Request, Response, NextFunction } from 'express';
import { SearchRequestModel } from '../models/search-request.model';
import { requireUser } from '../middlewares/auth.middleware';
import { runMatchingForSearchRequest } from '../services/matcher.service';

const router = Router();

// Crear una solicitud de búsqueda (crear alerta)
router.post('/', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const { searchName, description, category, isMinor } = req.body;

    if (!searchName) {
      return res.status(400).json({ error: 'El nombre de búsqueda es obligatorio' });
    }

    const newRequest = await SearchRequestModel.create({
      user: userId,
      searchName,
      description,
      category,
      isMinor
    });

    runMatchingForSearchRequest(newRequest._id.toString()).catch(console.error);

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
    const { status } = req.body;

    if (!['activa', 'resuelta', 'cancelada'].includes(status)) {
       return res.status(400).json({ error: 'Estado inválido' });
    }

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
