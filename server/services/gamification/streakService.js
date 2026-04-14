/* eslint-env node */

import pool from '../../database.js';
import { GAMIFICATION_CONFIG, formatDateISO, getEndOfDay } from './config.js';

let streakInfrastructurePromise = null;

const normalizeLimit = (value, fallback) => {
  const normalized = Math.floor(Number(value || fallback));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return Math.max(1, Math.floor(Number(fallback || 1)));
  }
  return normalized;
};

const toDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const normalized = new Date(value);
  return Number.isNaN(normalized.getTime()) ? '' : formatDateISO(normalized);
};

const ensureUserStreaksInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_streaks (
      user_id INT UNSIGNED PRIMARY KEY,
      daily_activity_streak INT NOT NULL DEFAULT 0,
      workout_streak INT NOT NULL DEFAULT 0,
      recovery_streak INT NOT NULL DEFAULT 0,
      weekly_consistency_streak INT NOT NULL DEFAULT 0,
      freeze_tokens INT NOT NULL DEFAULT 0,
      last_activity_date DATE NULL,
      protected_today TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_streaks_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  );
};

const ensureUserStreaksInfrastructureOnce = async () => {
  if (!streakInfrastructurePromise) {
    streakInfrastructurePromise = ensureUserStreaksInfrastructure().catch((error) => {
      streakInfrastructurePromise = null;
      throw error;
    });
  }
  return streakInfrastructurePromise;
};

const computeConsecutiveRun = (dateKeys, stepDays = 1) => {
  const uniqueSorted = [...new Set((Array.isArray(dateKeys) ? dateKeys : []).filter(Boolean))].sort().reverse();
  if (!uniqueSorted.length) return 0;

  let streak = 0;
  let cursor = new Date(`${uniqueSorted[0]}T00:00:00`);
  if (Number.isNaN(cursor.getTime())) return 0;

  for (const key of uniqueSorted) {
    const candidate = new Date(`${key}T00:00:00`);
    if (Number.isNaN(candidate.getTime())) continue;
    const diffDays = Math.round((cursor.getTime() - candidate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - stepDays);
      continue;
    }
    if (diffDays > 0) break;
  }

  return streak;
};

const getRecentWorkoutDays = async (userId) => {
  const limit = normalizeLimit(GAMIFICATION_CONFIG.streaks.maxLookbackDays, 45);
  const [rows] = await pool.execute(
    `SELECT DISTINCT DATE(created_at) AS activity_day
     FROM workout_sets
     WHERE user_id = ? AND completed = 1
     ORDER BY activity_day DESC
     LIMIT ${limit}`,
    [userId],
  );
  return rows.map((row) => toDateKey(row.activity_day)).filter(Boolean);
};

const getRecentRecoveryDays = async (userId) => {
  const limit = normalizeLimit(GAMIFICATION_CONFIG.streaks.maxLookbackDays, 45);
  const [rows] = await pool.execute(
    `SELECT DISTINCT DATE(recorded_at) AS activity_day
     FROM recovery_history
     WHERE user_id = ?
     ORDER BY activity_day DESC
     LIMIT ${limit}`,
    [userId],
  );
  return rows.map((row) => toDateKey(row.activity_day)).filter(Boolean);
};

const getRecentActivityDays = async (userId) => {
  const limit = normalizeLimit(GAMIFICATION_CONFIG.streaks.maxLookbackDays, 45);
  const [rows] = await pool.execute(
    `SELECT activity_day
     FROM (
       SELECT DISTINCT DATE(created_at) AS activity_day
       FROM workout_sets
       WHERE user_id = ? AND completed = 1
       UNION
       SELECT DISTINCT DATE(recorded_at) AS activity_day
       FROM recovery_history
       WHERE user_id = ?
     ) activity
     ORDER BY activity_day DESC
     LIMIT ${limit}`,
    [userId, userId],
  );
  return rows.map((row) => toDateKey(row.activity_day)).filter(Boolean);
};

const getRecentWorkoutWeeks = async (userId) => {
  const limit = normalizeLimit(GAMIFICATION_CONFIG.streaks.maxLookbackWeeks, 16);
  const [rows] = await pool.execute(
    `SELECT DISTINCT DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) AS week_start
     FROM workout_sets
     WHERE user_id = ? AND completed = 1
     ORDER BY week_start DESC
     LIMIT ${limit}`,
    [userId],
  );
  return rows.map((row) => toDateKey(row.week_start)).filter(Boolean);
};

export const getStreakSnapshot = async ({ userId, metrics = null } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return {
      dailyActivity: 0,
      workout: 0,
      recovery: 0,
      weeklyConsistency: 0,
      freezeTokens: 0,
      protectedToday: false,
      lastActivityDate: null,
    };
  }

  await ensureUserStreaksInfrastructureOnce();

  const [existingRows, workoutDays, recoveryDays, activityDays, workoutWeeks] = await Promise.all([
    pool.execute(
      `SELECT freeze_tokens, protected_today, last_activity_date
       FROM user_streaks
       WHERE user_id = ?
       LIMIT 1`,
      [normalizedUserId],
    ).then(([rows]) => rows),
    getRecentWorkoutDays(normalizedUserId),
    getRecentRecoveryDays(normalizedUserId),
    getRecentActivityDays(normalizedUserId),
    getRecentWorkoutWeeks(normalizedUserId),
  ]);

  const dailyActivity = Math.max(0, computeConsecutiveRun(activityDays, 1));
  const workout = Math.max(0, computeConsecutiveRun(workoutDays, 1));
  const recovery = Math.max(0, computeConsecutiveRun(recoveryDays, 1));
  const weeklyConsistency = Math.max(0, computeConsecutiveRun(workoutWeeks, 7));
  const existing = existingRows[0] || null;
  const actedToday = Number(metrics?.workout_days_today || 0) > 0 || Number(metrics?.recovery_logs_today || 0) > 0;
  const lastActivityDate = activityDays[0] || toDateKey(existing?.last_activity_date) || null;

  await pool.execute(
    `INSERT INTO user_streaks
       (user_id, daily_activity_streak, workout_streak, recovery_streak, weekly_consistency_streak, freeze_tokens, last_activity_date, protected_today)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       daily_activity_streak = VALUES(daily_activity_streak),
       workout_streak = VALUES(workout_streak),
       recovery_streak = VALUES(recovery_streak),
       weekly_consistency_streak = VALUES(weekly_consistency_streak),
       last_activity_date = VALUES(last_activity_date),
       protected_today = VALUES(protected_today),
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalizedUserId,
      dailyActivity,
      workout,
      recovery,
      weeklyConsistency,
      Math.max(0, Number(existing?.freeze_tokens || 0)),
      lastActivityDate,
      actedToday ? 0 : Number(existing?.protected_today || 0) ? 1 : 0,
    ],
  );

  return {
    dailyActivity,
    workout,
    recovery,
    weeklyConsistency,
    freezeTokens: Math.max(0, Number(existing?.freeze_tokens || 0)),
    protectedToday: !!existing?.protected_today,
    lastActivityDate,
  };
};

export const getStreakRiskState = ({
  metrics = null,
  streakSnapshot = null,
  now = new Date(),
} = {}) => {
  const streaks = streakSnapshot || {
    dailyActivity: 0,
    workout: 0,
    recovery: 0,
    weeklyConsistency: 0,
    freezeTokens: 0,
    protectedToday: false,
    lastActivityDate: null,
  };

  const actedToday = Number(metrics?.workout_days_today || 0) > 0 || Number(metrics?.recovery_logs_today || 0) > 0;
  const streakAtRisk = !actedToday && streaks.dailyActivity > 0;
  const urgent = streakAtRisk && streaks.dailyActivity >= GAMIFICATION_CONFIG.streaks.urgentAtDays;
  const recommendedAction = Number(metrics?.recovery_logs_today || 0) > 0 ? 'workout' : 'recovery_checkin';

  return {
    active: streakAtRisk,
    urgent,
    actedToday,
    canProtect: !actedToday && streaks.freezeTokens > 0,
    freezeTokens: streaks.freezeTokens,
    dailyActivityStreak: streaks.dailyActivity,
    workoutStreak: streaks.workout,
    recoveryStreak: streaks.recovery,
    weeklyConsistencyStreak: streaks.weeklyConsistency,
    protectedToday: !!streaks.protectedToday,
    lastActivityDate: streaks.lastActivityDate || null,
    expiryAt: formatDateISO(getEndOfDay(now)),
    recommendedAction,
    title: streakAtRisk
      ? `🔥 Your ${streaks.dailyActivity}-day streak is at risk`
      : null,
    description: streakAtRisk
      ? (recommendedAction === 'recovery_checkin'
        ? 'Do a quick recovery check-in to save it.'
        : 'Complete a session today to protect your momentum.')
      : null,
  };
};
