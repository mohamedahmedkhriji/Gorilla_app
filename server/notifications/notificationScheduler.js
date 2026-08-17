import { NOTIFICATION_TYPES } from './types.js';
import { getSubscriptionReminderDays } from './rules.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_DAYS = new Set([7, 3, 1, 0]);

const getTableColumns = async (pool, tableName) => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME)));
};

const getLocalParts = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
  } catch {
    return getLocalParts(date, 'UTC');
  }
};

const parseWorkoutDays = (value) => {
  if (Array.isArray(value)) return value.map((day) => String(day).toLowerCase());
  try {
    const parsed = JSON.parse(String(value || ''));
    if (Array.isArray(parsed)) return parsed.map((day) => String(day).toLowerCase());
  } catch {
    // Fall through to comma-separated legacy values.
  }
  return String(value || '').split(',').map((day) => day.trim().toLowerCase()).filter(Boolean);
};

const runOnboardingReminders = async ({ pool, notificationService, userColumns }) => {
  if (!userColumns.has('onboarding_completed')) return 0;
  const [users] = await pool.execute(
    `SELECT id
     FROM users
     WHERE is_active = 1
       AND COALESCE(onboarding_completed, 0) = 0
       AND created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY id
     LIMIT 500`,
  );
  // A stable per-user key gives this reminder a one-time initial cadence.
  const results = await Promise.all(users.map((user) => notificationService.sendNotification({
    userId: user.id,
    type: NOTIFICATION_TYPES.ONBOARDING_REMINDER,
    route: '/onboarding',
    entityType: 'user_profile',
    entityId: user.id,
    notificationKey: `ONBOARDING_REMINDER:${user.id}:24h`,
  })));
  return results.filter((result) => result.created).length;
};

const runWorkoutReminders = async ({ pool, notificationService, userColumns, now }) => {
  if (!userColumns.has('workout_days') || !userColumns.has('preferred_time')) return 0;
  const [users] = await pool.execute(
    `SELECT id, workout_days, preferred_time, timezone
     FROM users
     WHERE is_active = 1 AND workout_days IS NOT NULL AND preferred_time IS NOT NULL
     ORDER BY id
     LIMIT 1000`,
  );
  let created = 0;
  for (const user of users) {
    const local = getLocalParts(now, user.timezone || 'UTC');
    const days = parseWorkoutDays(user.workout_days);
    if (!days.includes(String(local.weekday || '').toLowerCase())) continue;
    const preferredMatch = String(user.preferred_time || '').match(/^(\d{1,2}):(\d{2})/);
    if (!preferredMatch) continue;
    const currentMinutes = Number(local.hour) * 60 + Number(local.minute);
    const workoutMinutes = Number(preferredMatch[1]) * 60 + Number(preferredMatch[2]);
    if (workoutMinutes - currentMinutes < 55 || workoutMinutes - currentMinutes > 65) continue;
    const localDate = `${local.year}-${local.month}-${local.day}`;
    const result = await notificationService.sendNotification({
      userId: user.id,
      type: NOTIFICATION_TYPES.WORKOUT_REMINDER,
      variables: { workoutName: 'Your workout' },
      route: '/workout',
      entityType: 'workout_schedule',
      notificationKey: `WORKOUT_REMINDER:${user.id}:${localDate}`,
    });
    if (result.created) created += 1;
  }
  return created;
};

const runSubscriptionReminders = async ({ pool, notificationService, userColumns, now }) => {
  const expiryColumn = ['subscription_expires_at', 'subscription_end_date', 'subscription_expiry']
    .find((column) => userColumns.has(column));
  if (!expiryColumn) return 0;
  const [users] = await pool.query(
    `SELECT id, ${expiryColumn} AS expires_at
     FROM users
     WHERE is_active = 1 AND ${expiryColumn} IS NOT NULL
     ORDER BY id
     LIMIT 1000`,
  );
  let created = 0;
  for (const user of users) {
    const expiry = new Date(user.expires_at);
    if (!Number.isFinite(expiry.getTime())) continue;
    const daysRemaining = getSubscriptionReminderDays(expiry, now);
    if (!REMINDER_DAYS.has(daysRemaining)) continue;
    const result = await notificationService.sendNotification({
      userId: user.id,
      type: NOTIFICATION_TYPES.SUBSCRIPTION_REMINDER,
      variables: { subscriptionType: 'RepSet', daysRemaining },
      route: '/subscription',
      entityType: 'subscription',
      data: { daysRemaining, subscriptionType: 'repset' },
      notificationKey: `SUBSCRIPTION_REMINDER:${user.id}:repset:${daysRemaining}`,
    });
    if (result.created) created += 1;
  }
  return created;
};

export const runNotificationSchedulerOnce = async ({ pool, notificationService, now = new Date() }) => {
  const userColumns = await getTableColumns(pool, 'users');
  const context = { pool, notificationService, userColumns, now };
  const [onboarding, workouts, subscriptions] = await Promise.all([
    runOnboardingReminders(context),
    runWorkoutReminders(context),
    runSubscriptionReminders(context),
  ]);
  console.info('Notification scheduler executed', { onboarding, workouts, subscriptions });
  return { onboarding, workouts, subscriptions };
};

export const startNotificationScheduler = ({ pool, notificationService, intervalMs = DEFAULT_INTERVAL_MS }) => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runNotificationSchedulerOnce({ pool, notificationService });
    } catch (error) {
      console.error('Notification scheduler failed:', error?.message || error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref?.();
  const initialTimer = setTimeout(() => void run(), 15_000);
  initialTimer.unref?.();
  return {
    stop: () => {
      clearInterval(timer);
      clearTimeout(initialTimer);
    },
  };
};
