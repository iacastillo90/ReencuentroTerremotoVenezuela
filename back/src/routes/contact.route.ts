import { Router, Request, Response } from 'express';
import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { requireUser } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';

const router = Router();

// Enviar un mensaje a un caso (enmascarado)
router.post('/', requireUser, async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).user.userId;
    const { reportId, message, receiverId } = req.body;

    if (!reportId || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

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
    console.error('[ContactRoute] POST / Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Obtener mis mensajes enviados
router.get('/sent', requireUser, async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).user.userId;
    const messages = await CaseContactModel.find({ senderId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    console.error('[ContactRoute] GET /sent Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Obtener mensajes recibidos (los que están dirigidos a mis reportes)
router.get('/received', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    // Buscar mensajes donde soy el receiverId
    const messages = await CaseContactModel.find({ receiverId: userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(messages);
  } catch (error) {
    console.error('[ContactRoute] GET /received Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const contactRouter = router;
