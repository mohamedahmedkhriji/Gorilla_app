import { io } from 'socket.io-client';

const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

export const socketService = {
  connect: (id: number, type: 'user' | 'coach') => {
    if (!id || !type) return;
    console.log('Joining room for', type, id);
    socket.emit('join', { id, type });
  },

  sendMessage: (senderId: number, senderType: 'user' | 'coach', receiverId: number, receiverType: 'user' | 'coach', message: string) => {
    console.log('Sending message:', { senderId, senderType, receiverId, receiverType, message });
    socket.emit('sendMessage', { senderId, senderType, receiverId, receiverType, message });
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

  disconnect: () => {
    socket.off('newMessage');
    socket.off('messageError');
  }
};
