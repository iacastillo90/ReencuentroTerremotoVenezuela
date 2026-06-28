import { Router, Request, Response } from 'express';
import { CaseContactModel } from '../models/case-contact.model';
import { PersonModel } from '../models/unified-person.model';
import { requireUser } from '../middlewares/auth.middleware';

const router = Router();

// Enviar un mensaje a un caso (enmascarado)
router.post('/', requireUser, async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).user.userId;
    const { reportId, message } = req.body;

    if (!reportId || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const person = await PersonModel.findOne({ idHash: reportId }).lean();
    if (!person) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const contact = await CaseContactModel.create({
      reportId,
      senderId,
      // Si tenemos el usuario que reportó (metadata.reportedBy), lo guardamos como receiver
      receiverId: person.metadata?.reportedBy || undefined,
      message
    });

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
