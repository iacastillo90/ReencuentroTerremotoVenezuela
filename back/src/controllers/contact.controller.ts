import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../middlewares/error.middleware';
import { findPersonByReportId, createContact, getSentMessages, getReceivedMessages } from '../services/contact.service';

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

    const person = await findPersonByReportId(reportId);
    if (!person) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const finalReceiverId = receiverId || person.metadata?.reportedBy?.toString() || undefined;

    const contact = await createContact(reportId, senderId, message, finalReceiverId);

    return res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
}

export async function getSentMessagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const senderId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getSentMessages(senderId, limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getReceivedMessagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await getReceivedMessages(userId, limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
