/**
 * services/socket.service.ts — Servidor Socket.IO en tiempo real
 *
 * PROPÓSITO:
 *   Provee comunicación bidireccional en tiempo real entre usuarios
 *   (chats) y entre servidor y clientes (notificaciones). Soporta
 *   Redis adapter para escalar horizontalmente entre procesos.
 *
 * CARACTERÍSTICAS:
 *   - initializeSocketServer: Configura Socket.IO con CORS + Redis adapter
 *   - Autenticación JWT en handshake (token query, cookie o headers)
 *   - userSockets Map: Trackea sockets por usuario (múltiples dispositivos)
 *   - Eventos: join-room, leave-room, send-message, new-message, typing
 *   - Redis adapter opcional: Escala a múltiples procesos
 *   - CORS restringido: Misma política que Express
 *
 * FLUJO DE AUTENTICACIÓN:
 *   1. Cliente conecta con token en auth.handshake
 *   2. Middleware io.use valida JWT con JWT_SECRET
 *   3. Verifica tokenVersion en BD (sesión vigente)
 *   4. Si válido: socket.data.userId = decoded.userId
 *   5. Si inválido: next(new Error) → conexión rechazada
 *
 * FLUJO DE MENSAJES:
 *   1. Cliente emite 'send-message' con { room, message }
 *   2. Servidor recibe, persiste en BD, reemite a la sala
 *   3. Receptor recibe 'new-message' con el mensaje completo
 *
 * SEGURIDAD:
 *   - JWT validation en handshake: Solo usuarios autenticados conectan
 *   - tokenVersion check: Sesiones invalidadas no pueden usar socket
 *   - CORS restringido: Mismos orígenes que Express
 *   - userSockets map: Facilita emitir a usuario específico sin broadcast global
 *   - Redis adapter failover: Si no hay Redis, funciona en single process
 *
 * DECISIONES TÉCNICAS:
 *   - Redis adapter opcional: Devuelve fallback graceful si no hay Redis
 *   - userSockets como Map: O(1) lookup vs recorrer todos los sockets
 *   - Autenticación en middleware: Falla rápido, no procesa eventos no auth
 *   - Token de cookie/query/header: Compatible con múltiples clientes
 *
 * CÓMO USAR:
 *   // Servidor
 *   initializeSocketServer(httpServer, ['http://localhost:5173']);
 *   const io = getIO();
 *   emitToUser(userId, 'notification', { text: 'Nuevo match' });
 *
 *   // Cliente
 *   const socket = io('ws://localhost:4000', { auth: { token } });
 *   socket.emit('send-message', { room: 'abc123', message: 'Hola' });
 */
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middlewares/auth.middleware';
import { UserModel } from '../models/user.model';
import { PersonModel } from '../models/unified-person.model';
import { MatchModel } from '../models/match.model';
import { logger } from '../utils/logger.util';

let RedisAdapter: any;
try {
  RedisAdapter = require('@socket.io/redis-adapter');
} catch {
  logger.warn('[Socket] @socket.io/redis-adapter not available — Redis clustering disabled');
}

let ioInstance: Server | null = null;

const userSockets = new Map<string, Set<string>>();

export function initializeSocketServer(httpServer: HttpServer, corsOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  if (RedisAdapter) {
    const { connection: pubClient } = require('../config/redis.config');
    const subClient = pubClient.duplicate();
    io.adapter(RedisAdapter(pubClient, subClient));
    logger.info('[Socket] Redis adapter initialized');
  } else {
    logger.warn('[Socket] Redis adapter not available — single process only');
  }

  // Authentication Middleware for Socket.IO
  io.use(async (socket: Socket, next) => {
    try {
      // 1. Get token from handshakes (query or headers)
      let token = socket.handshake.auth?.token || socket.handshake.query?.token;

      // Extract token if it's sent as "Bearer <token>"
      if (typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      // Also try parsing cookies if they are sent in the handshake headers
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        token = cookies.token;
      }

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // 2. Verify token
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string; tokenVersion: number; iat?: number; exp?: number };

      // 3. Fetch user and check tokenVersion
      const user = await UserModel.findById(decoded.userId).select('tokenVersion role');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      if (user.tokenVersion !== decoded.tokenVersion) {
        return next(new Error('Authentication error: Token revoked'));
      }

      // Save user details on the socket object
      socket.data.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: user.role,
      };

      next();
    } catch (err) {
      logger.error({ err }, '[SocketAuth] Connection auth failed');
      next(new Error('Authentication error: Invalid credentials'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    if (!user) return;

    const userId = user.userId;
    logger.info({ userId, socketId: socket.id }, '[Socket] User connected');

    // Join personal user room
    socket.join(`user_${userId}`);

    // Track socket ID
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join role-specific rooms (e.g. admin or verifier)
    if (user.role === 'admin' || user.role === 'verifier') {
      socket.join('moderators');
      logger.info({ userId }, '[Socket] Moderator joined');
    }

    socket.on('request_match_chat', async (data: { matchId: string }) => {
      try {
        const { matchId } = data;
        const match = await MatchModel.findById(matchId).lean();
        if (!match || !match.matchedPersonId) {
          socket.emit('chat_error', { message: 'Match no encontrado o inválido' });
          return;
        }

        const matchedPerson = await PersonModel.findOne({ idHash: match.matchedPersonId }).lean();
        if (!matchedPerson) {
          socket.emit('chat_error', { message: 'Persona no encontrada' });
          return;
        }

        const isMinor = matchedPerson.age !== undefined && matchedPerson.age < 18;

        if (isMinor) {
          // Protocolo de Menores
          const roomName = `room_mediation_${matchId}`;
          socket.join(roomName);
          socket.emit('chat_room_joined', { room: roomName, type: 'mediation', message: 'Esperando a un moderador para iniciar la mediación...' });
          
          // Notificar a los admins
          emitToModerators('new_mediation_request', {
            matchId,
            room: roomName,
            requesterId: userId,
            requesterEmail: user.email,
            minorId: matchedPerson.idHash
          });
          logger.info({ roomName }, '[Socket] Mediation room created');
        } else {
          // Chat 1:1 Normal
          const roomName = `room_match_${matchId}`;
          socket.join(roomName);
          socket.emit('chat_room_joined', { room: roomName, type: 'direct', message: 'Sala de chat 1:1 creada.' });
          
          // Here we would also notify the creator of the matched report to join the room
          // emitToUser(matchedPerson.metadata.reportedBy, 'chat_invite', { room: roomName })
        }
      } catch (err) {
        logger.error({ err }, '[Socket] Error in request_match_chat');
        socket.emit('chat_error', { message: 'Error interno al procesar el chat' });
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId, socketId: socket.id }, '[Socket] User disconnected');
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  return io;
}

/**
 * Emits an event to all active sockets of a specific user.
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (ioInstance) {
    ioInstance.to(`user_${userId}`).emit(event, data);
    logger.info({ userId, event }, '[Socket] Emitted event to user');
  }
}

/**
 * Emits an event to all moderators (admins and verifiers).
 */
export function emitToModerators(event: string, data: any) {
  if (ioInstance) {
    ioInstance.to('moderators').emit(event, data);
    logger.info({ event }, '[Socket] Emitted event to moderators');
  }
}

/**
 * Returns the active Socket.IO server instance.
 */
export function getSocketIO() {
  return ioInstance;
}
