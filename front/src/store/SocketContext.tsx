/**
 * store/SocketContext.tsx — Conexión WebSocket y notificaciones
 *
 * PROPÓSITO:
 *   Mantiene una conexión Socket.IO con el backend para:
 *   1. Chat en tiempo real (mensajes directos, salas de mediación).
 *   2. Notificaciones push (nuevos mensajes, cambios de estado).
 *
 * ¿CÓMO FUNCIONA?
 *   - Se conecta solo cuando hay un usuario logueado (useAuth).
 *   - Usa socket.io-client con transporte websocket (fallback polling).
 *   - Escucha eventos 'notification' para notificaciones en tiempo real.
 *   - Escucha 'receive_message' para chat (ver ProfilePage).
 *   - Al cerrar sesión (user → null), desconecta el socket.
 *
 ¿POR QUÉ UN CONTEXTO?
 *   Necesitamos que socket sea accesible desde cualquier componente
 *   (ProfilePage para chat, App para notificaciones). Un contexto
 *   evita prop drilling o crear una nueva conexión en cada página.
 *
 * EXPONE:
 *   socket:          instancia de Socket.IO (null si no conectado)
 *   isConnected:     estado de la conexión
 *   notifications:   array de notificaciones recibidas
 *   unreadCount:     conteo de no leídas
 *   markAllAsRead:   marca todas como leídas
 *   clearNotifications: limpia la lista
 *
 * USO:
 *   const { socket, isConnected } = useSocket();
 *   socket?.emit('request_match_chat', { matchId });
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  createdAt: Date;
  read: boolean;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Solo conecta si hay sesión activa.
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to server');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setIsConnected(false);
    });

    // Notificaciones en tiempo real (ej: nuevo mensaje).
    socketInstance.on('notification', (data: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' }) => {
      console.log('[Socket] Notification received:', data);
      const newNotif: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        createdAt: new Date(),
        read: false,
      };
      setNotifications(prev => [newNotif, ...prev]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SocketContext.Provider
      value={{
        socket, isConnected,
        notifications, unreadCount,
        markAllAsRead, clearNotifications,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
