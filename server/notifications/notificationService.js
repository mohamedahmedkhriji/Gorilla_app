import { getFirebaseMessaging } from './firebaseAdmin.js';
import { renderNotificationTemplate } from './templates.js';
import {
  PROMOTIONAL_CATEGORIES,
  TYPE_TO_CATEGORY,
  VALID_NOTIFICATION_TYPES,
} from './types.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
]);

const toSafeRoute = (route) => {
  const value = String(route || '').trim();
  return value.startsWith('/') && value.length <= 255 && !value.startsWith('//') ? value : null;
};

const toDataPayload = (value) => Object.fromEntries(
  Object.entries(value || {})
    .filter(([, item]) => item !== undefined && item !== null)
    .map(([key, item]) => [String(key), typeof item === 'string' ? item : JSON.stringify(item)]),
);

export class NotificationService {
  constructor({ pool, io }) {
    this.pool = pool;
    this.io = io;
  }

  async getUserContext(userId) {
    const [rows] = await this.pool.execute(
      `SELECT u.id, u.notification_locale, u.timezone,
              s.coach_messages, s.training, s.social, s.challenges,
              s.gym, s.content, s.shop, s.subscription
       FROM users u
       LEFT JOIN user_notification_settings s ON s.user_id = u.id
       WHERE u.id = ? AND u.is_active = 1
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  }

  isPushEnabled(user, category) {
    if (!user) return false;
    const key = category === 'coach_messages' ? 'coach_messages' : category;
    return user[key] == null ? true : Boolean(user[key]);
  }

  async sendNotification({
    userId,
    type,
    variables = {},
    route,
    entityType,
    entityId,
    data = {},
    notificationKey,
    title,
    body,
    suppressPush = false,
  }) {
    const normalizedUserId = Number(userId || 0);
    if (!normalizedUserId || !VALID_NOTIFICATION_TYPES.has(type)) {
      throw new Error('Invalid notification request');
    }

    const category = TYPE_TO_CATEGORY[type];
    const user = await this.getUserContext(normalizedUserId);
    if (!user) return { created: false, reason: 'user_not_found' };

    const pushEnabled = this.isPushEnabled(user, category);
    if (PROMOTIONAL_CATEGORIES.has(category) && !pushEnabled) {
      return { created: false, reason: 'preference_disabled' };
    }

    const localized = renderNotificationTemplate(type, user.notification_locale, variables);
    const safeRoute = toSafeRoute(route);
    const storedData = {
      ...data,
      type,
      category,
      route: safeRoute || undefined,
      entityId: entityId == null ? undefined : String(entityId),
    };

    try {
      const [result] = await this.pool.execute(
        `INSERT INTO notifications
           (user_id, type, category, title, message, data, route, entity_type, entity_id,
            notification_key, is_read, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
        [
          normalizedUserId,
          type,
          category,
          String(title || localized.title).slice(0, 255),
          String(body || localized.body),
          JSON.stringify(storedData),
          safeRoute,
          String(entityType || '').trim().slice(0, 80) || null,
          entityId == null ? null : String(entityId).slice(0, 191),
          String(notificationKey || '').trim().slice(0, 191) || null,
        ],
      );

      const notification = {
        id: Number(result.insertId),
        user_id: normalizedUserId,
        type,
        category,
        title: String(title || localized.title),
        message: String(body || localized.body),
        data: storedData,
        route: safeRoute,
        entity_type: entityType || null,
        entity_id: entityId == null ? null : String(entityId),
        unread: true,
        created_at: new Date().toISOString(),
      };

      this.io?.to(`user-${normalizedUserId}`).emit('notification:new', notification);

      let pushResult = { attempted: 0, success: 0, failure: 0 };
      if (pushEnabled && !suppressPush) {
        pushResult = await this.sendPush(notification);
      }

      console.info('Notification created', {
        id: notification.id,
        userId: normalizedUserId,
        type,
        socketDelivered: true,
        push: pushResult,
      });
      return { created: true, notification, push: pushResult };
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY' && notificationKey) {
        return { created: false, reason: 'duplicate' };
      }
      throw error;
    }
  }

  async sendPush(notification) {
    const messaging = getFirebaseMessaging();
    if (!messaging) return { attempted: 0, success: 0, failure: 0, disabled: true };

    const [devices] = await this.pool.execute(
      `SELECT id, push_token
       FROM user_devices
       WHERE user_id = ? AND is_active = 1
       ORDER BY last_seen_at DESC
       LIMIT 500`,
      [notification.user_id],
    );
    if (!devices.length) return { attempted: 0, success: 0, failure: 0 };

    const response = await messaging.sendEachForMulticast({
      tokens: devices.map((device) => device.push_token),
      notification: { title: notification.title, body: notification.message },
      data: toDataPayload({
        notificationId: notification.id,
        type: notification.type,
        category: notification.category,
        route: notification.route || '',
        entityId: notification.entity_id || '',
      }),
      android: { priority: 'high' },
    });

    const invalidDeviceIds = [];
    response.responses.forEach((item, index) => {
      if (!item.success && INVALID_TOKEN_CODES.has(item.error?.code)) {
        invalidDeviceIds.push(Number(devices[index].id));
      }
    });
    if (invalidDeviceIds.length) {
      const placeholders = invalidDeviceIds.map(() => '?').join(',');
      await this.pool.execute(
        `UPDATE user_devices SET is_active = 0 WHERE id IN (${placeholders})`,
        invalidDeviceIds,
      );
    }
    if (response.successCount > 0) {
      await this.pool.execute('UPDATE notifications SET push_sent_at = NOW() WHERE id = ?', [notification.id]);
    }
    return {
      attempted: devices.length,
      success: response.successCount,
      failure: response.failureCount,
      invalidDisabled: invalidDeviceIds.length,
    };
  }

  async sendToUsers(userIds, payload) {
    const uniqueIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const results = [];
    for (let index = 0; index < uniqueIds.length; index += 25) {
      const chunk = uniqueIds.slice(index, index + 25);
      results.push(...await Promise.all(chunk.map((userId) => this.sendNotification({ ...payload, userId }))));
    }
    return results;
  }
}
