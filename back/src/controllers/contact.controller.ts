/**
 * controllers/contact.controller.ts — Controlador de mensajería
 *
 * PROPÓSITO:
 *   Maneja la mensajería entre usuarios del sistema: enviar mensajes
 *   relacionados a reportes de personas, recibir mensajes, y listar
 *   conversaciones. Los mensajes en tiempo real se envían vía Socket.IO.
 *
 * CARACTERÍSTICAS:
 *   - sendContactMessage: Enviar mensaje sobre un reporte
 *   - getSentMessagesHandler: Mensajes enviados (paginado)
 *   - getReceivedMessagesHandler: Mensajes recibidos (paginado)
 *   - Receptor automático: Si no se especifica receiverId, busca al creador del reporte
 *
 * FLUJO DE DATOS:
 *   1. Usuario envía mensaje con reportId + message
 *   2. Zod valida input (reportId, message, optional receiverId)
 *   3. findPersonByReportId verifica que el reporte existe
 *   4. Si no hay receiverId, usa metadata.reportedBy del reporte
 *   5. createContact persiste + emite socket al receptor
 *   6. Receptor recibe notificación en tiempo real
 *
 * SEGURIDAD:
 *   - requireUser en todos los endpoints (solo usuarios autenticados)
 *   - Zod validation: message max 5000 chars, reportId max 50 chars
 *   - findPersonByReportId: Verifica existencia del reporte antes de enviar
 *   - No exponer mensajes de otros usuarios: Filtrado por senderId/receiverId
 *
 * ENDPOINTS:
 *   POST   /api/contact/send — Enviar mensaje
 *   GET    /api/contact/sent — Mensajes enviados
 *   GET    /api/contact/received — Mensajes recibidos
 *
 * DECISIONES TÉCNICAS:
 *   - receiverId opcional: Simplifica el flujo (el sistema infiere el receptor)
 *   - Paginación separada sent/received: Mejor UX que un solo feed mezclado
 *   - 201 para envío: Recurso creado (mensaje es un recurso persistente)
 *   - Socket.IO emit: Notificación en tiempo real sin polling
 *
 * CÓMO USAR:
 *   POST /api/contact/send { reportId: 'abc123', message: 'Tengo información' }
 *   GET /api/contact/sent?limit=20&offset=0
 */
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
