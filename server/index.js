import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import pool from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', ALLOWED_ORIGIN],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', ALLOWED_ORIGIN], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api', routes);

const emitToParticipant = (id, type, eventName, payload) => {
  io.to(`user-${id}`).to(`${type}-${id}`).emit(eventName, payload);
};

io.on('connection', (socket) => {
  socket.on('join', ({ id, type }) => {
    if (!id || !type) return;
    socket.join(`user-${id}`);
    socket.join(`${type}-${id}`);
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const {
        senderId,
        senderType,
        receiverId,
        receiverType,
        message,
      } = payload || {};

      if (!senderId || !receiverId || !senderType || !receiverType || !message?.trim()) {
        socket.emit('messageError', { error: 'Invalid message payload' });
        return;
      }

      const cleanMessage = String(message).trim();

      const [insertResult] = await pool.execute(
        `INSERT INTO messages
           (sender_id, receiver_id, sender_type, receiver_type, message, message_type, is_read)
         VALUES (?, ?, ?, ?, ?, 'text', 0)`,
        [senderId, receiverId, senderType, receiverType, cleanMessage]
      );

      const [rows] = await pool.execute(
        `SELECT
            m.id,
            m.sender_id,
            m.receiver_id,
            m.sender_type,
            m.receiver_type,
            m.message,
            m.is_read,
            m.created_at,
            u.name AS sender_name
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?
         LIMIT 1`,
        [insertResult.insertId]
      );

      if (!rows.length) {
        socket.emit('messageError', { error: 'Message not found after insert' });
        return;
      }

      const outgoing = {
        ...rows[0],
        read: !!rows[0].is_read,
      };

      emitToParticipant(senderId, senderType, 'newMessage', outgoing);
      emitToParticipant(receiverId, receiverType, 'newMessage', outgoing);

      await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, data, is_read)
         VALUES (?, 'message', 'New message', ?, JSON_OBJECT('senderId', ?, 'senderType', ?), 0)`,
        [receiverId, cleanMessage, senderId, senderType]
      );
    } catch (error) {
      socket.emit('messageError', { error: error.message || 'Failed to send message' });
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
