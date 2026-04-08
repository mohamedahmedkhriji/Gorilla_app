import process from 'node:process';
import pool from '../database.js';

const DEFAULT_EXPIRED_BAN_CLEANUP_INTERVAL_MS = 60_000;
let expiredBanCleanupPromise = null;
let ensureUserStatusColumnsPromise = null;

const getColumnPrefix = (alias = '') => {
  const normalizedAlias = String(alias || '').trim();
  return normalizedAlias ? `${normalizedAlias}.` : '';
};

export const buildActiveUserStateClause = (alias = '') => {
  const prefix = getColumnPrefix(alias);
  return `${prefix}is_active = 1 AND (${prefix}ban_delete_at IS NULL OR ${prefix}ban_delete_at > NOW())`;
};

export const buildVisibleUserClause = (alias = '') => {
  const prefix = getColumnPrefix(alias);
  return `${buildActiveUserStateClause(alias)} AND (${prefix}banned_until IS NULL OR ${prefix}banned_until < NOW())`;
};

export const deactivateExpiredBannedUsers = async () => {
  if (expiredBanCleanupPromise) {
    return expiredBanCleanupPromise;
  }

  expiredBanCleanupPromise = (async () => {
    if (!ensureUserStatusColumnsPromise) {
      ensureUserStatusColumnsPromise = (async () => {
        const ensureColumnExists = async (columnName, alterSql) => {
          const [rows] = await pool.execute(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = 'users'
               AND column_name = ?
             LIMIT 1`,
            [columnName],
          );

          if (!rows.length) {
            await pool.execute(alterSql);
          }
        };

        await ensureColumnExists('is_active', 'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
        await ensureColumnExists('banned_until', 'ALTER TABLE users ADD COLUMN banned_until DATETIME NULL');
        await ensureColumnExists('ban_reason', 'ALTER TABLE users ADD COLUMN ban_reason VARCHAR(255) NULL');
        await ensureColumnExists('ban_created_at', 'ALTER TABLE users ADD COLUMN ban_created_at DATETIME NULL');
        await ensureColumnExists('ban_delete_at', 'ALTER TABLE users ADD COLUMN ban_delete_at DATETIME NULL');
      })().catch((error) => {
        ensureUserStatusColumnsPromise = null;
        throw error;
      });
    }

    await ensureUserStatusColumnsPromise;

    const [result] = await pool.execute(
      `UPDATE users
       SET is_active = 0
       WHERE is_active = 1
         AND ban_delete_at IS NOT NULL
         AND ban_delete_at <= NOW()`,
    );
    return Number(result?.affectedRows || 0);
  })();

  try {
    return await expiredBanCleanupPromise;
  } finally {
    expiredBanCleanupPromise = null;
  }
};

const getExpiredBanCleanupIntervalMs = () => {
  const parsedValue = Number(
    process.env.EXPIRED_BAN_CLEANUP_INTERVAL_MS || DEFAULT_EXPIRED_BAN_CLEANUP_INTERVAL_MS,
  );
  if (!Number.isFinite(parsedValue) || parsedValue < 1_000) {
    return DEFAULT_EXPIRED_BAN_CLEANUP_INTERVAL_MS;
  }
  return parsedValue;
};

export const startExpiredBannedUserCleanup = ({ intervalMs, logger = console } = {}) => {
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 1_000
    ? intervalMs
    : getExpiredBanCleanupIntervalMs();

  let stopped = false;

  const runCleanup = async () => {
    if (stopped) return 0;

    try {
      return await deactivateExpiredBannedUsers();
    } catch (error) {
      logger.error?.('Failed to deactivate expired banned users:', error?.message || error);
      return 0;
    }
  };

  void runCleanup();

  const timer = setInterval(() => {
    void runCleanup();
  }, safeIntervalMs);
  timer.unref?.();

  return {
    runCleanup,
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
};
