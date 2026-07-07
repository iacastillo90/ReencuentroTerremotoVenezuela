import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { requireUser } from '../middlewares/auth.middleware';
import { ValidationError } from '../middlewares/error.middleware';

const contactSchema = z.object({
  reportId: z.string().min(1).max(50),
  message: z.string().min(1).max(5000),
});

const router = Router();

// Enviar un mensaje a un caso (enmascarado)
router.post('/', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const senderId = (req as any).user.userId;

    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Datos de contacto inválidos', { errors: parsed.error.issues }));
    }
    const { reportId, message } = parsed.data;

    const person = await PersonModel.findOne({ idHash: reportId }).lean();
    if (!person) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const contact = await CaseContactModel.create({
      reportId,
      senderId,
      receiverId: person.metadata?.reportedBy || undefined,
      message
    });

    return res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// Obtener mis mensajes enviados
router.get('/sent', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const senderId = (req as any).user.userId;
    const messages = await CaseContactModel.find({ senderId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
});

// Obtener mensajes recibidos (los que están dirigidos a mis reportes)
router.get('/received', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const messages = await CaseContactModel.find({ receiverId: userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
});

export const contactRouter = router;
