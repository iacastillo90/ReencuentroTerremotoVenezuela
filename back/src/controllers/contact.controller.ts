import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';
import { emitToUser } from '../services/socket.service';
import { ValidationError } from '../middlewares/error.middleware';

const contactSchema = z.object({
  reportId: z.string().min(1).max(50),
  message: z.string().min(1).max(5000),
  receiverId: z.string().optional(),
});

export async function sendContactMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const senderId = req.user!.userId;
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Datos de contacto inválidos', { errors: parsed.error.issues }));
    }
    const { reportId, message, receiverId } = parsed.data;

    const person = await PersonModel.findOne({ idHash: reportId }).lean();
    if (!person) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const finalReceiverId = receiverId || person.metadata?.reportedBy || undefined;

    const contact = await CaseContactModel.create({
      reportId,
      senderId,
      receiverId: finalReceiverId,
      message
    });

    if (finalReceiverId) {
      try {
        emitToUser(finalReceiverId.toString(), 'notification', {
          title: 'Nuevo Mensaje Recibido',
          message: `Alguien ha enviado información sobre el reporte de "${person.name}".`,
          type: 'info'
        });

        emitToUser(finalReceiverId.toString(), 'receive_message', {
          _id: contact._id,
          reportId,
          senderId,
          receiverId: finalReceiverId,
          message,
          createdAt: contact.createdAt
        });
      } catch (err) {
        logger.warn({ err }, '[ContactRoute] Socket notification failed');
      }
    }

    return res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
}

export async function getSentMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const senderId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const [messages, total] = await Promise.all([
      CaseContactModel.find({ senderId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      CaseContactModel.countDocuments({ senderId }),
    ]);
    return res.status(200).json({ data: messages, total, limit, offset });
  } catch (error) {
    next(error);
  }
}

export async function getReceivedMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const [messages, total] = await Promise.all([
      CaseContactModel.find({ receiverId: userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      CaseContactModel.countDocuments({ receiverId: userId }),
    ]);
    return res.status(200).json({ data: messages, total, limit, offset });
  } catch (error) {
    next(error);
  }
}
