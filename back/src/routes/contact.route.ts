import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { requireUser } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';
import { ValidationError } from '../middlewares/error.middleware';

const contactSchema = z.object({
  reportId: z.string().min(1).max(50),
  message: z.string().min(1).max(5000),
  receiverId: z.string().optional(),
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
    const { reportId, message, receiverId } = parsed.data;

    const person = await PersonModel.findOne({ idHash: reportId }).lean();
    if (!person) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    // Si se pasa receiverId, es una respuesta directa. De lo contrario, va al dueño del reporte.
    const finalReceiverId = receiverId || person.metadata?.reportedBy || undefined;

    const contact = await CaseContactModel.create({
      reportId,
      senderId,
      receiverId: finalReceiverId,
      message
    });

    // Notificar al destinatario por WebSocket en tiempo real
    if (finalReceiverId) {
      try {
        emitToUser(finalReceiverId.toString(), 'notification', {
          title: 'Nuevo Mensaje Recibido',
          message: `Alguien ha enviado información sobre el reporte de "${person.name}".`,
          type: 'info'
        });
        
        // También emitir un evento 'receive_message' para actualizar el chat en tiempo real si el usuario tiene el chat abierto
        emitToUser(finalReceiverId.toString(), 'receive_message', {
          _id: contact._id,
          reportId,
          senderId,
          receiverId: finalReceiverId,
          message,
          createdAt: contact.createdAt
        });
      } catch (err) {
        console.warn('[ContactRoute] No se pudo enviar notificación por socket:', err);
      }
    }

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
