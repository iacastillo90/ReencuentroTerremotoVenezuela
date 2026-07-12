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

interface SocketConnectionContextType {
  socket: Socket | null;
  isConnected: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const SocketConnectionContext = createContext<SocketConnectionContextType | undefined>(undefined);
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
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
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('notification', (data: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' }) => {
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
    <SocketConnectionContext.Provider value={{ socket, isConnected }}>
      <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead, clearNotifications }}>
        {children}
      </NotificationContext.Provider>
    </SocketConnectionContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketConnectionContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a SocketProvider');
  }
  return context;
};
