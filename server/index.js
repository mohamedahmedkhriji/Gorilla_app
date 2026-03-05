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
const ALLOWED_ORIGINS = String(process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!ALLOWED_ORIGINS.length) {
  console.warn('CLIENT_URL is not set. CORS will allow all origins until CLIENT_URL is configured.');
}

const isAllowedOrigin = (origin) => {
  // Allow non-browser clients/tools with no Origin header.
  if (!origin) return true;
  if (!ALLOWED_ORIGINS.length) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https?:\/\/localhost:\d+$/i.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin);
};

const server = http.createServer(app);
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const ensureNotificationSettingsTable = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id INT UNSIGNED PRIMARY KEY,
      coach_messages TINYINT(1) NOT NULL DEFAULT 1,
      rest_timer TINYINT(1) NOT NULL DEFAULT 1,
      mission_challenge TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  );
};

const isNotificationEnabled = async (userId, key) => {
  await ensureNotificationSettingsTable();
  const [rows] = await pool.execute(
    `SELECT coach_messages, rest_timer, mission_challenge
     FROM user_notification_settings
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );
  if (!rows.length) return true;

  const row = rows[0];
  if (key === 'coach_messages') return !!row.coach_messages;
  if (key === 'rest_timer') return !!row.rest_timer;
  if (key === 'mission_challenge') return !!row.mission_challenge;
  return true;
};

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: true,
  },
});

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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

  socket.on('typing', ({ senderId, senderType, receiverId, receiverType }) => {
    if (!senderId || !senderType || !receiverId || !receiverType) return;
    io.to(`user-${receiverId}`).to(`${receiverType}-${receiverId}`).emit('typing', {
      sender_id: senderId,
      sender_type: senderType,
      receiver_id: receiverId,
      receiver_type: receiverType,
      is_typing: true,
    });
  });

  socket.on('stopTyping', ({ senderId, senderType, receiverId, receiverType }) => {
    if (!senderId || !senderType || !receiverId || !receiverType) return;
    io.to(`user-${receiverId}`).to(`${receiverType}-${receiverId}`).emit('typing', {
      sender_id: senderId,
      sender_type: senderType,
      receiver_id: receiverId,
      receiver_type: receiverType,
      is_typing: false,
    });
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

      const coachMessageNotificationsEnabled = await isNotificationEnabled(receiverId, 'coach_messages');
      if (coachMessageNotificationsEnabled) {
        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, data, is_read)
           VALUES (?, 'message', 'New message', ?, JSON_OBJECT('senderId', ?, 'senderType', ?), 0)`,
          [receiverId, cleanMessage, senderId, senderType]
        );
      }
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
