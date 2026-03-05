import { io } from 'socket.io-client';

const DEFAULT_SOCKET_ORIGIN =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5001`
    : 'http://localhost:5001';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : DEFAULT_SOCKET_ORIGIN);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 5000,
});

let hasLoggedConnectError = false;
let pendingJoin: { id: number; type: 'user' | 'coach' } | null = null;

socket.on('connect', () => {
  hasLoggedConnectError = false;
  console.log('Socket connected:', socket.id);
  if (pendingJoin) {
    socket.emit('join', pendingJoin);
  }
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error: Error) => {
  if (hasLoggedConnectError) return;
  hasLoggedConnectError = true;
  console.warn('Socket unavailable:', error?.message || 'Connection failed');
});

export const socketService = {
  connect: (id: number, type: 'user' | 'coach') => {
    if (!id || !type) return;
    pendingJoin = { id, type };
    if (!socket.connected) {
      socket.connect();
    }
    console.log('Joining room for', type, id);
    socket.emit('join', { id, type });
  },

  sendMessage: (senderId: number, senderType: 'user' | 'coach', receiverId: number, receiverType: 'user' | 'coach', message: string) => {
    console.log('Sending message:', { senderId, senderType, receiverId, receiverType, message });
    socket.emit('sendMessage', { senderId, senderType, receiverId, receiverType, message });
  },

  sendTyping: (
    senderId: number,
    senderType: 'user' | 'coach',
    receiverId: number,
    receiverType: 'user' | 'coach',
    isTyping: boolean,
  ) => {
    socket.emit(isTyping ? 'typing' : 'stopTyping', {
      senderId,
      senderType,
      receiverId,
      receiverType,
    });
  },

  onNewMessage: (callback: (message: any) => void) => {
    const handler = (msg: any) => {
      console.log('New message received:', msg);
      callback(msg);
    };

    socket.on('newMessage', handler);

    return () => {
      socket.off('newMessage', handler);
    };
  },

  onTyping: (callback: (payload: any) => void) => {
    const handler = (payload: any) => callback(payload);
    socket.on('typing', handler);
    return () => {
      socket.off('typing', handler);
    };
  },

  disconnect: () => {
    socket.off('newMessage');
    socket.off('typing');
    socket.off('messageError');
    pendingJoin = null;
    socket.disconnect();
  }
};
