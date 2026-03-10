/* eslint-env node */
import pool from '../database.js';

const XP_LEVELS = [
  { levelNumber: 1, levelName: 'Beginner', xpRequired: 0, tier: 1 },
  { levelNumber: 2, levelName: 'Rookie', xpRequired: 100, tier: 2 },
  { levelNumber: 3, levelName: 'Trainee', xpRequired: 250, tier: 3 },
  { levelNumber: 4, levelName: 'Active', xpRequired: 500, tier: 4 },
  { levelNumber: 5, levelName: 'Dedicated', xpRequired: 900, tier: 5 },
  { levelNumber: 6, levelName: 'Challenger', xpRequired: 1500, tier: 6 },
  { levelNumber: 7, levelName: 'Performer', xpRequired: 2300, tier: 7 },
  { levelNumber: 8, levelName: 'Athlete', xpRequired: 3500, tier: 8 },
  { levelNumber: 9, levelName: 'Advanced', xpRequired: 5000, tier: 9 },
  { levelNumber: 10, levelName: 'Pro', xpRequired: 7000, tier: 10 },
  { levelNumber: 11, levelName: 'Elite', xpRequired: 9500, tier: 11 },
  { levelNumber: 12, levelName: 'Master', xpRequired: 12500, tier: 12 },
  { levelNumber: 13, levelName: 'Champion', xpRequired: 16000, tier: 13 },
  { levelNumber: 14, levelName: 'Titan', xpRequired: 21000, tier: 14 },
  { levelNumber: 15, levelName: 'Legend', xpRequired: 28000, tier: 15 },
];

const DEFAULT_XP_BY_SOURCE = {
  workout: 40,
  planned_workout: 60,
  sleep: 8,
  hydration: 8,
  nutrition: 10,
  mission_complete: 50,
  challenge_complete: 50,
  challenge_win: 80,
  program_week: 75,
  program_complete: 250,
  badge_unlock: 0,
  achievement_unlock: 0,
  level_up: 0,
  progress_photo: 20,
  share: 10,
  referral: 100,
  pr: 35,
  manual_adjustment: 0,
};

const XP_DAILY_CAPS = {
  workout: 150,
  social: 50,
  wellness: 40,
  total: 250,
};

const XP_SOURCE_GROUPS = {
  workout: new Set([
    'workout',
    'planned_workout',
    'pr',
    'mission_complete',
    'challenge_complete',
    'challenge_win',
    'program_week',
    'program_complete',
  ]),
  social: new Set([
    'share',
    'referral',
    'progress_photo',
  ]),
  wellness: new Set([
    'nutrition',
    'hydration',
    'sleep',
  ]),
};

let xpInfrastructurePromise = null;

const normalizeUserId = (userId) => {
  const value = Number(userId);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

const toFiniteNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const ensureXpInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS levels (
      id INT PRIMARY KEY AUTO_INCREMENT,
      level_number INT NOT NULL UNIQUE,
      level_name VARCHAR(80) NOT NULL,
      xp_required INT NOT NULL,
      tier INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS xp_transactions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      source_type ENUM(
        'workout',
        'planned_workout',
        'pr',
        'challenge_complete',
        'challenge_win',
        'mission_complete',
        'nutrition',
        'hydration',
        'sleep',
        'progress_photo',
        'share',
        'referral',
        'program_week',
        'program_complete',
        'badge_unlock',
        'achievement_unlock',
        'level_up',
        'manual_adjustment'
      ) NOT NULL,
      source_id BIGINT NULL,
      xp_amount INT NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_xp_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_xp_user_created (user_id, created_at)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_xp (
      user_id INT UNSIGNED PRIMARY KEY,
      total_xp INT NOT NULL DEFAULT 0,
      current_level_id INT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_xp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_xp_level
        FOREIGN KEY (current_level_id) REFERENCES levels(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
  );

  for (const level of XP_LEVELS) {
    await pool.execute(
      `INSERT INTO levels (level_number, level_name, xp_required, tier)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         level_name = VALUES(level_name),
         xp_required = VALUES(xp_required),
         tier = VALUES(tier)`,
      [level.levelNumber, level.levelName, level.xpRequired, level.tier],
    );
  }
};

const ensureXpInfrastructureOnce = async () => {
  if (!xpInfrastructurePromise) {
    xpInfrastructurePromise = ensureXpInfrastructure().catch((error) => {
      xpInfrastructurePromise = null;
      throw error;
    });
  }
  return xpInfrastructurePromise;
};

const toLevelPayload = (row) => {
  if (!row) return null;
  return {
    id: Number(row.id),
    levelNumber: Number(row.level_number ?? row.levelNumber ?? 0),
    name: row.level_name ?? row.levelName ?? '',
    xpRequired: Number(row.xp_required ?? row.xpRequired ?? 0),
    tier: Number(row.tier ?? 0),
  };
};

const getLevelForXp = async (xp) => {
  const [rows] = await pool.execute(
    `SELECT id, level_number, level_name, xp_required, tier
     FROM levels
     WHERE xp_required <= ?
     ORDER BY xp_required DESC, id DESC
     LIMIT 1`,
    [Math.max(0, Math.floor(toFiniteNumber(xp, 0)))],
  );
  return toLevelPayload(rows[0] || null);
};

const getNextLevelForXp = async (xp) => {
  const [rows] = await pool.execute(
    `SELECT id, level_number, level_name, xp_required, tier
     FROM levels
     WHERE xp_required > ?
     ORDER BY xp_required ASC, id ASC
     LIMIT 1`,
    [Math.max(0, Math.floor(toFiniteNumber(xp, 0)))],
  );
  return toLevelPayload(rows[0] || null);
};

const grantLevelRewards = async ({ userId, levelId }) => {
  if (!levelId) return [];

  try {
    const [rewardRows] = await pool.execute(
      `SELECT lr.reward_id, r.name, r.reward_type
       FROM level_rewards lr
       JOIN rewards r ON r.id = lr.reward_id
       LEFT JOIN user_rewards ur
         ON ur.user_id = ? AND ur.reward_id = lr.reward_id AND ur.source_type = 'level' AND ur.source_id = lr.level_id
       WHERE lr.level_id = ?
         AND ur.id IS NULL`,
      [userId, levelId],
    );

    if (!rewardRows.length) return [];

    for (const reward of rewardRows) {
      await pool.execute(
        `INSERT INTO user_rewards
           (user_id, reward_id, source_type, source_id, status)
         VALUES (?, ?, 'level', ?, 'available')`,
        [userId, Number(reward.reward_id), levelId],
      );
    }

    return rewardRows.map((reward) => ({
      id: Number(reward.reward_id),
      name: reward.name || 'Reward',
      rewardType: reward.reward_type || 'cosmetic',
      sourceType: 'level',
      sourceId: Number(levelId),
    }));
  } catch {
    return [];
  }
};

export const getDefaultXpAmount = (sourceType) =>
  Math.max(0, Math.floor(toFiniteNumber(DEFAULT_XP_BY_SOURCE[String(sourceType || '')], 0)));

const resolveXpGroup = (sourceType) => {
  const normalized = String(sourceType || '').trim();
  if (!normalized) return null;
  if (XP_SOURCE_GROUPS.workout.has(normalized)) return 'workout';
  if (XP_SOURCE_GROUPS.social.has(normalized)) return 'social';
  if (XP_SOURCE_GROUPS.wellness.has(normalized)) return 'wellness';
  return null;
};

const getTodayXpTotal = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(xp_amount), 0) AS total_xp
     FROM xp_transactions
     WHERE user_id = ?
       AND DATE(created_at) = CURDATE()`,
    [userId],
  );
  return Math.max(0, Math.floor(toFiniteNumber(rows[0]?.total_xp, 0)));
};

const getTodayXpBySourceGroup = async (userId, groupName) => {
  if (!groupName || !XP_SOURCE_GROUPS[groupName]) return 0;
  const sourceTypes = Array.from(XP_SOURCE_GROUPS[groupName]);
  if (!sourceTypes.length) return 0;
  const placeholders = sourceTypes.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(xp_amount), 0) AS total_xp
     FROM xp_transactions
     WHERE user_id = ?
       AND DATE(created_at) = CURDATE()
       AND source_type IN (${placeholders})`,
    [userId, ...sourceTypes],
  );
  return Math.max(0, Math.floor(toFiniteNumber(rows[0]?.total_xp, 0)));
};

const getTrainingStreakDays = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT DISTINCT DATE(created_at) AS workout_day
     FROM workout_sets
     WHERE user_id = ? AND completed = 1
     ORDER BY workout_day DESC
     LIMIT 45`,
    [userId],
  );

  const dateSet = new Set(
    rows
      .map((row) => {
        const d = row?.workout_day;
        if (!d) return '';
        if (typeof d === 'string') return d.slice(0, 10);
        const parsed = new Date(d);
        return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
      })
      .filter(Boolean),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 45; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const getWorkoutMorningBonus = async ({ userId, sourceType, sourceId }) => {
  if (!['workout', 'planned_workout'].includes(sourceType)) return 0;
  if (!Number.isInteger(sourceId) || sourceId <= 0) return 0;

  const [sessionRows] = await pool.execute(
    `SELECT completed_at
     FROM workout_sessions
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [sourceId, userId],
  );

  if (!sessionRows.length || !sessionRows[0]?.completed_at) return 0;
  const completedAt = new Date(sessionRows[0].completed_at);
  if (Number.isNaN(completedAt.getTime())) return 0;
  if (completedAt.getHours() >= 7) return 0;

  const [earlierRows] = await pool.execute(
    `SELECT COUNT(*) AS c
     FROM workout_sessions
     WHERE user_id = ?
       AND status = 'completed'
       AND completed_at IS NOT NULL
       AND DATE(completed_at) = DATE(?)
       AND completed_at < ?`,
    [userId, completedAt, completedAt],
  );

  return Number(earlierRows[0]?.c || 0) === 0 ? 10 : 0;
};

export const recomputeUserXpSummary = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  await ensureXpInfrastructureOnce();

  const [[xpRows]] = await Promise.all([
    pool.execute(
      `SELECT COALESCE(SUM(xp_amount), 0) AS total_xp
       FROM xp_transactions
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
  ]);

  const totalXp = Math.max(0, Math.floor(toFiniteNumber(xpRows[0]?.total_xp, 0)));
  const currentLevel = await getLevelForXp(totalXp);
  const nextLevel = await getNextLevelForXp(totalXp);

  await pool.execute(
    `INSERT INTO user_xp (user_id, total_xp, current_level_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_xp = VALUES(total_xp),
       current_level_id = VALUES(current_level_id),
       updated_at = CURRENT_TIMESTAMP`,
    [normalizedUserId, totalXp, currentLevel?.id || null],
  );

  await pool.execute(
    `UPDATE users
     SET total_xp = ?, current_level_id = ?
     WHERE id = ?`,
    [totalXp, currentLevel?.id || null, normalizedUserId],
  );

  const rewards = await grantLevelRewards({ userId: normalizedUserId, levelId: currentLevel?.id || null });

  return {
    userId: normalizedUserId,
    totalXp,
    currentLevel,
    nextLevel,
    rewards,
  };
};

export const getUserXpSummary = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  await ensureXpInfrastructureOnce();

  const [rows] = await pool.execute(
    `SELECT ux.total_xp,
            ux.current_level_id,
            l.level_number,
            l.level_name,
            l.xp_required,
            l.tier
     FROM user_xp ux
     LEFT JOIN levels l ON l.id = ux.current_level_id
     WHERE ux.user_id = ?
     LIMIT 1`,
    [normalizedUserId],
  );

  if (!rows.length) {
    return recomputeUserXpSummary(normalizedUserId);
  }

  const totalXp = Math.max(0, Math.floor(toFiniteNumber(rows[0]?.total_xp, 0)));
  const currentLevel = rows[0]?.current_level_id
    ? toLevelPayload({
        id: rows[0].current_level_id,
        level_number: rows[0].level_number,
        level_name: rows[0].level_name,
        xp_required: rows[0].xp_required,
        tier: rows[0].tier,
      })
    : await getLevelForXp(totalXp);
  const nextLevel = await getNextLevelForXp(totalXp);

  return {
    userId: normalizedUserId,
    totalXp,
    currentLevel,
    nextLevel,
    rewards: [],
  };
};

export const awardXpOnce = async ({
  userId,
  sourceType,
  sourceId = null,
  xpAmount = null,
  description = null,
} = {}) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  await ensureXpInfrastructureOnce();

  const normalizedSourceType = String(sourceType || '').trim();
  if (!normalizedSourceType) {
    throw new Error('sourceType is required');
  }

  const normalizedSourceId = sourceId == null ? null : Math.floor(toFiniteNumber(sourceId, 0));
  const baseXp = xpAmount == null
    ? getDefaultXpAmount(normalizedSourceType)
    : Math.max(0, Math.floor(toFiniteNumber(xpAmount, 0)));

  if (normalizedSourceId != null) {
    const [existingRows] = await pool.execute(
      `SELECT id
       FROM xp_transactions
       WHERE user_id = ? AND source_type = ? AND source_id = ?
       LIMIT 1`,
      [normalizedUserId, normalizedSourceType, normalizedSourceId],
    );

    if (existingRows.length) {
      const summary = await getUserXpSummary(normalizedUserId);
      return {
        awarded: false,
        xpGained: 0,
        ...summary,
      };
    }
  }

  if (baseXp <= 0) {
    const summary = await getUserXpSummary(normalizedUserId);
    return {
      awarded: false,
      xpGained: 0,
      ...summary,
    };
  }

  let calculatedXp = baseXp;
  let streakBonusPercent = 0;
  let morningBonusXp = 0;

  if (normalizedSourceType === 'workout' || normalizedSourceType === 'planned_workout') {
    const streakDays = await getTrainingStreakDays(normalizedUserId);
    if (streakDays >= 30) streakBonusPercent = 0.35;
    else if (streakDays >= 7) streakBonusPercent = 0.20;
    else if (streakDays >= 3) streakBonusPercent = 0.10;
    calculatedXp = Math.max(0, Math.floor(baseXp * (1 + streakBonusPercent)));
    morningBonusXp = await getWorkoutMorningBonus({
      userId: normalizedUserId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
    });
    calculatedXp += Math.max(0, Math.floor(morningBonusXp));
  }

  if (normalizedSourceType !== 'manual_adjustment') {
    const groupName = resolveXpGroup(normalizedSourceType);
    const [todayTotalXp, todayGroupXp] = await Promise.all([
      getTodayXpTotal(normalizedUserId),
      groupName ? getTodayXpBySourceGroup(normalizedUserId, groupName) : Promise.resolve(0),
    ]);

    const remainingTotalXp = Math.max(0, XP_DAILY_CAPS.total - todayTotalXp);
    const groupCap = groupName ? XP_DAILY_CAPS[groupName] : null;
    const remainingGroupXp = groupCap == null ? remainingTotalXp : Math.max(0, groupCap - todayGroupXp);
    calculatedXp = Math.max(0, Math.min(calculatedXp, remainingGroupXp, remainingTotalXp));
  }

  if (calculatedXp <= 0) {
    const summary = await getUserXpSummary(normalizedUserId);
    return {
      awarded: false,
      xpGained: 0,
      capReached: true,
      streakBonusPercent,
      morningBonusXp,
      ...summary,
    };
  }

  await pool.execute(
    `INSERT INTO xp_transactions (user_id, source_type, source_id, xp_amount, description)
     VALUES (?, ?, ?, ?, ?)`,
    [normalizedUserId, normalizedSourceType, normalizedSourceId, calculatedXp, description || null],
  );

  const summary = await recomputeUserXpSummary(normalizedUserId);
  return {
    awarded: true,
    xpGained: calculatedXp,
    baseXp,
    streakBonusPercent,
    morningBonusXp,
    ...summary,
  };
};
