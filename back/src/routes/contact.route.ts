/**
 * routes/contact.route.ts — Rutas de mensajería
 *
 * PROPÓSITO:
 *   Rutas para el sistema de mensajería entre usuarios. Todos los
 *   endpoints requieren autenticación (requireUser).
 *
 * ENDPOINTS:
 *   POST /api/contact — Enviar mensaje (body: { reportId, message, receiverId? })
 *   GET  /api/contact/sent — Mensajes enviados por el usuario
 *   GET  /api/contact/received — Mensajes recibidos por el usuario
 *
 * @module contact.route
 */
import { Router } from 'express';
import { requireUser } from '../middlewares/auth.middleware';
import { sendContactMessage, getSentMessagesHandler, getReceivedMessagesHandler } from '../controllers/contact.controller';

const router = Router();

router.post('/', requireUser, sendContactMessage);
router.get('/sent', requireUser, getSentMessagesHandler);
router.get('/received', requireUser, getReceivedMessagesHandler);

export const contactRouter = router;
