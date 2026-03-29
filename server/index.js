import process from 'node:process';
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import pool from './database.js';
import {
  createSecurityHeadersMiddleware,
  getBearerToken,
  getRoleSocketType,
  verifyAuthToken,
} from './auth.js';
import { startExpiredBannedUserCleanup } from './services/userStatusService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const ALLOWED_ORIGINS = String(process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalOrigin = (origin) => /^https?:\/\/localhost:\d+$/i.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin);

if (!ALLOWED_ORIGINS.length) {
  console.warn('CLIENT_URL is not set. Browser CORS is restricted to localhost origins until CLIENT_URL is configured.');
}

const isAllowedOrigin = (origin) => {
  // Allow non-browser clients/tools with no Origin header.
  if (!origin) return true;
  if (!ALLOWED_ORIGINS.length) return !IS_PRODUCTION && isLocalOrigin(origin);
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return !IS_PRODUCTION && isLocalOrigin(origin);
};

const server = http.createServer(app);
let expiredBannedUserCleanup = null;
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
app.use(createSecurityHeadersMiddleware());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api', routes);

const emitToParticipant = (id, type, eventName, payload) => {
  io.to(`user-${id}`).to(`${type}-${id}`).emit(eventName, payload);
};

const loadSocketAuthUser = async (token) => {
  const decoded = verifyAuthToken(token);
  if (!decoded?.userId) return null;

  const [rows] = await pool.execute(
    `SELECT id, name, role, gym_id, coach_id, is_active
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [decoded.userId],
  );

  if (!rows.length) return null;
  const user = rows[0];
  if (Number(user.is_active || 0) !== 1) return null;

  return {
    id: Number(user.id),
    name: String(user.name || '').trim() || 'User',
    role: String(user.role || '').trim(),
    gym_id: user.gym_id == null ? null : Number(user.gym_id),
    coach_id: user.coach_id == null ? null : Number(user.coach_id),
  };
};

const isAllowedMessageRecipient = async (authUser, receiverId, receiverType) => {
  const normalizedReceiverId = Number(receiverId || 0);
  const normalizedReceiverType = String(receiverType || '').trim().toLowerCase();
  if (!normalizedReceiverId || !normalizedReceiverType) return false;

  if (authUser.role === 'user') {
    if (normalizedReceiverType !== 'coach') return false;
    return Number(authUser.coach_id || 0) === normalizedReceiverId;
  }

  if (authUser.role === 'coach') {
    if (normalizedReceiverType !== 'user') return false;

    const [rows] = await pool.execute(
      `SELECT coach_id, is_active
       FROM users
       WHERE id = ? AND role = 'user'
       LIMIT 1`,
      [normalizedReceiverId],
    );

    if (!rows.length) return false;
    return Number(rows[0].is_active || 0) === 1 && Number(rows[0].coach_id || 0) === Number(authUser.id || 0);
  }

  return false;
};

io.use(async (socket, next) => {
  try {
    const token = String(socket.handshake?.auth?.token || '').trim()
      || getBearerToken(socket.handshake?.headers || {});
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const authUser = await loadSocketAuthUser(token);
    if (!authUser || !['user', 'coach'].includes(authUser.role)) {
      return next(new Error('Invalid session'));
    }

    socket.data.authUser = authUser;
    return next();
  } catch (error) {
    return next(new Error(error?.message || 'Socket authentication failed'));
  }
});

io.on('connection', (socket) => {
  socket.on('join', () => {
    const authUser = socket.data.authUser;
    if (!authUser?.id) return;
    const participantType = getRoleSocketType(authUser.role);
    socket.join(`user-${authUser.id}`);
    socket.join(`${participantType}-${authUser.id}`);
  });

  socket.on('typing', async ({ receiverId, receiverType }) => {
    const authUser = socket.data.authUser;
    if (!authUser?.id) return;

    try {
      const allowed = await isAllowedMessageRecipient(authUser, receiverId, receiverType);
      if (!allowed) return;

      const senderType = getRoleSocketType(authUser.role);
      io.to(`user-${receiverId}`).to(`${receiverType}-${receiverId}`).emit('typing', {
        sender_id: authUser.id,
        sender_type: senderType,
        receiver_id: Number(receiverId),
        receiver_type: receiverType,
        is_typing: true,
      });
    } catch {
      // Ignore typing errors so reconnects stay smooth.
    }
  });

  socket.on('stopTyping', async ({ receiverId, receiverType }) => {
    const authUser = socket.data.authUser;
    if (!authUser?.id) return;

    try {
      const allowed = await isAllowedMessageRecipient(authUser, receiverId, receiverType);
      if (!allowed) return;

      const senderType = getRoleSocketType(authUser.role);
      io.to(`user-${receiverId}`).to(`${receiverType}-${receiverId}`).emit('typing', {
        sender_id: authUser.id,
        sender_type: senderType,
        receiver_id: Number(receiverId),
        receiver_type: receiverType,
        is_typing: false,
      });
    } catch {
      // Ignore typing errors so reconnects stay smooth.
    }
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const authUser = socket.data.authUser;
      if (!authUser?.id) {
        socket.emit('messageError', { error: 'Authentication required' });
        return;
      }

      const {
        receiverId,
        receiverType,
        message,
      } = payload || {};

      if (!receiverId || !receiverType || !message?.trim()) {
        socket.emit('messageError', { error: 'Invalid message payload' });
        return;
      }

      const allowed = await isAllowedMessageRecipient(authUser, receiverId, receiverType);
      if (!allowed) {
        socket.emit('messageError', { error: 'You are not allowed to message this participant' });
        return;
      }

      const cleanMessage = String(message).trim();
      const senderType = getRoleSocketType(authUser.role);

      const [insertResult] = await pool.execute(
        `INSERT INTO messages
           (sender_id, receiver_id, sender_type, receiver_type, message, message_type, is_read)
         VALUES (?, ?, ?, ?, ?, 'text', 0)`,
        [authUser.id, receiverId, senderType, receiverType, cleanMessage]
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

      emitToParticipant(authUser.id, senderType, 'newMessage', outgoing);
      emitToParticipant(receiverId, receiverType, 'newMessage', outgoing);

      const coachMessageNotificationsEnabled = await isNotificationEnabled(receiverId, 'coach_messages');
      if (coachMessageNotificationsEnabled) {
        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, data, is_read)
           VALUES (?, 'message', 'New message', ?, JSON_OBJECT('senderId', ?, 'senderType', ?), 0)`,
          [receiverId, cleanMessage, authUser.id, senderType]
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

const hasHealthyServerOnPort = async (port) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    if (!response.ok) return false;

    const data = await response.json();
    return data?.status === 'OK';
  } catch {
    return false;
  }
};

server.on('error', (error) => {
  if (error?.code !== 'EADDRINUSE') {
    throw error;
  }

  void (async () => {
    const hasHealthyServer = await hasHealthyServerOnPort(PORT);
    if (hasHealthyServer) {
      console.log(`Backend already running on port ${PORT}. Reusing existing server.`);
      console.log('Restart the existing backend manually if you need fresh server code loaded.');
      process.exit(0);
      return;
    }

    console.error(`Port ${PORT} is already in use by another process.`);
    console.error('Stop the process using that port or change PORT in .env before starting the server.');
    process.exit(1);
  })();
});

process.on('SIGINT', () => {
  expiredBannedUserCleanup?.stop();
});

process.on('SIGTERM', () => {
  expiredBannedUserCleanup?.stop();
});

server.listen(PORT, () => {
  expiredBannedUserCleanup = startExpiredBannedUserCleanup();
  console.log(`Server running on port ${PORT}`);
});
