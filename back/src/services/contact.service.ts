import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';
import { emitToUser } from './socket.service';

export async function findPersonByReportId(reportId: string) {
  return PersonModel.findOne({ idHash: reportId }).lean();
}

export async function createContact(
  reportId: string,
  senderId: string,
  message: string,
  receiverId?: string,
) {
  const contact = await CaseContactModel.create({
    reportId,
    senderId,
    receiverId,
    message
  });

  if (receiverId) {
    try {
      emitToUser(receiverId.toString(), 'notification', {
        title: 'Nuevo Mensaje Recibido',
        message: `Alguien ha enviado información sobre el reporte de una persona.`,
        type: 'info'
      });

      emitToUser(receiverId.toString(), 'receive_message', {
        _id: contact._id,
        reportId,
        senderId,
        receiverId,
        message,
        createdAt: contact.createdAt
      });
    } catch (err) {
      logger.warn({ err }, '[ContactService] Socket notification failed');
    }
  }

  return contact;
}

export async function getSentMessages(senderId: string, limit: number, offset: number) {
  const [messages, total] = await Promise.all([
    CaseContactModel.find({ senderId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    CaseContactModel.countDocuments({ senderId }),
  ]);
  return { data: messages, total, limit, offset };
}

export async function getReceivedMessages(userId: string, limit: number, offset: number) {
  const [messages, total] = await Promise.all([
    CaseContactModel.find({ receiverId: userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    CaseContactModel.countDocuments({ receiverId: userId }),
  ]);
  return { data: messages, total, limit, offset };
}
