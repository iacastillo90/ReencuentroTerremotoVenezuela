/**
 * routes/contact.route.ts — Rutas de mensajería
 *
 * PROPÓSITO:
 *   Rutas para el sistema de mensajería entre usuarios. Todos los
 *   endpoints requieren autenticación (requireUser) y rate limiting.
 *
 * ENDPOINTS:
 *   POST /api/contact — Enviar mensaje (body: { reportId, message, receiverId? })
 *   GET  /api/contact/sent — Mensajes enviados por el usuario
 *   GET  /api/contact/received — Mensajes recibidos por el usuario
 *
 * RATE LIMITING:
 *   - POST: 10 req/min (previene spam de mensajes)
 *   - GET: 30 req/min (lectura de mensajes)
 *
 * @module contact.route
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import { sendContactMessage, getSentMessagesHandler, getReceivedMessagesHandler } from '../controllers/contact.controller';

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes. Intente nuevamente en 1 minuto.' }
});

const getLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.' }
});

const router = Router();

router.post('/', postLimiter, requireUser, sendContactMessage);
router.get('/sent', getLimiter, requireUser, getSentMessagesHandler);
router.get('/received', getLimiter, requireUser, getReceivedMessagesHandler);

export const contactRouter = router;
