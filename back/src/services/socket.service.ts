import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middlewares/auth.middleware';
import { UserModel } from '../models/user.model';
import { PersonModel } from '../models/unified-person.model';
import { MatchModel } from '../models/match.model';

let ioInstance: Server | null = null;

// Map user ID to set of socket IDs (a user can have multiple tabs/sockets open)
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
      const decoded = jwt.verify(token, getJwtSecret()) as any;

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
      console.error('[SocketAuth] Connection auth failed:', err);
      next(new Error('Authentication error: Invalid credentials'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    if (!user) return;

    const userId = user.userId;
    console.log(`[Socket] User connected: ${userId} (${user.email}) - Socket: ${socket.id}`);

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
      console.log(`[Socket] Moderator joined: ${userId}`);
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
          console.log(`[Socket] Mediation room created for minor: ${roomName}`);
        } else {
          // Chat 1:1 Normal
          const roomName = `room_match_${matchId}`;
          socket.join(roomName);
          socket.emit('chat_room_joined', { room: roomName, type: 'direct', message: 'Sala de chat 1:1 creada.' });
          
          // Here we would also notify the creator of the matched report to join the room
          // emitToUser(matchedPerson.metadata.reportedBy, 'chat_invite', { room: roomName })
        }
      } catch (err) {
        console.error('[Socket] Error in request_match_chat:', err);
        socket.emit('chat_error', { message: 'Error interno al procesar el chat' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId} - Socket: ${socket.id}`);
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
    console.log(`[Socket] Emitted event '${event}' to user: ${userId}`);
  }
}

/**
 * Emits an event to all moderators (admins and verifiers).
 */
export function emitToModerators(event: string, data: any) {
  if (ioInstance) {
    ioInstance.to('moderators').emit(event, data);
    console.log(`[Socket] Emitted event '${event}' to moderators`);
  }
}

/**
 * Returns the active Socket.IO server instance.
 */
export function getSocketIO() {
  return ioInstance;
}
