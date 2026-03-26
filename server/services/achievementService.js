/* eslint-env node */
import pool from '../database.js';
import { collectUserProgressMetrics } from './badgeService.js';
import { awardXpOnce } from './xpService.js';

const ACHIEVEMENT_SEEDS = [
  {
    name: 'Momentum',
    slug: 'momentum',
    description: 'Earn 100 total XP.',
    xpReward: 30,
    rewardId: null,
    rules: [{ conditionType: 'total_xp', targetValue: 100 }],
  },
  {
    name: 'Mission Finisher',
    slug: 'mission-finisher',
    description: 'Complete 10 missions.',
    xpReward: 60,
    rewardId: null,
    rules: [{ conditionType: 'completed_missions', targetValue: 10 }],
  },
  {
    name: 'Recovery Discipline',
    slug: 'recovery-discipline',
    description: 'Log recovery on 7 different days.',
    xpReward: 45,
    rewardId: null,
    rules: [{ conditionType: 'recovery_logs_total', targetValue: 7 }],
  },
  {
    name: 'Badge Collector',
    slug: 'badge-collector',
    description: 'Unlock 3 badges.',
    xpReward: 75,
    rewardId: null,
    rules: [{ conditionType: 'unlocked_badges', targetValue: 3 }],
  },
  {
    name: 'Challenge Season',
    slug: 'challenge-season',
    description: 'Complete 3 challenges.',
    xpReward: 50,
    rewardId: null,
    rules: [{ conditionType: 'completed_challenges', targetValue: 3 }],
  },
];

let achievementInfrastructurePromise = null;

const slugifyValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeUserId = (userId) => {
  const value = Number(userId);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

const toFiniteNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const ensureColumnExists = async (tableName, columnName, alterSql) => {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );

  if (!rows.length) {
    await pool.execute(alterSql);
  }
};

const ensureIndexExists = async (tableName, indexName, createSql) => {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName],
  );

  if (!rows.length) {
    await pool.execute(createSql);
  }
};

const ensureColumnIsNullable = async (tableName, columnName, alterSql) => {
  const [rows] = await pool.execute(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );

  if (rows.length && String(rows[0].is_nullable || '').toUpperCase() !== 'YES') {
    await pool.execute(alterSql);
  }
};

const buildSlugUpdates = (rows, prefix) => {
  const usedSlugs = new Set();
  const updates = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const id = Number(row?.id || 0);
    const currentSlug = slugifyValue(row?.slug);
    const baseSlug = currentSlug || slugifyValue(row?.name) || `${prefix}-${id || 'item'}`;
    let nextSlug = baseSlug;

    if (usedSlugs.has(nextSlug)) {
      let suffix = id > 0 ? id : 2;
      while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
        suffix += 1;
      }
      nextSlug = `${baseSlug}-${suffix}`;
    }

    usedSlugs.add(nextSlug);
    if (currentSlug !== nextSlug) {
      updates.push({ id, slug: nextSlug });
    }
  }

  return updates;
};

const evaluateRule = (value, operatorSymbol, targetValue) => {
  if (operatorSymbol === '=') return value === targetValue;
  if (operatorSymbol === '<=') return value <= targetValue;
  if (operatorSymbol === '<') return value < targetValue;
  if (operatorSymbol === '>') return value > targetValue;
  return value >= targetValue;
};

const ensureAchievementInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS rewards (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      reward_type ENUM(
        'xp_boost',
        'profile_frame',
        'title',
        'avatar_item',
        'challenge_ticket',
        'discount',
        'premium_days',
        'coach_message',
        'feature_unlock',
        'cosmetic'
      ) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      value_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS achievements (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(140) NOT NULL UNIQUE,
      description VARCHAR(255) NOT NULL,
      xp_reward INT NOT NULL DEFAULT 0,
      reward_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_achievements_reward
        FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL,
      INDEX idx_achievements_reward (reward_id)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS achievement_rules (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      achievement_id BIGINT UNSIGNED NOT NULL,
      condition_type VARCHAR(80) NOT NULL,
      operator_symbol ENUM('>=', '=', '<=', '>', '<') NOT NULL DEFAULT '>=',
      target_value DECIMAL(12,2) NOT NULL,
      timeframe_type ENUM('lifetime', 'daily', 'weekly', 'monthly', 'program', 'custom') NOT NULL DEFAULT 'lifetime',
      timeframe_days INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_achievement_rules_achievement
        FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      INDEX idx_achievement_rules_achievement (achievement_id),
      INDEX idx_achievement_rules_type (condition_type)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_achievements (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      achievement_id BIGINT UNSIGNED NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_achievement (user_id, achievement_id),
      CONSTRAINT fk_user_achievements_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_achievements_achievement
        FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      INDEX idx_user_achievements_user (user_id),
      INDEX idx_user_achievements_unlocked (unlocked_at)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_rewards (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      reward_id BIGINT NOT NULL,
      source_type ENUM('level', 'badge', 'achievement', 'mission', 'manual') NOT NULL,
      source_id BIGINT NULL,
      granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      consumed_at TIMESTAMP NULL,
      status ENUM('available', 'consumed', 'expired') NOT NULL DEFAULT 'available',
      CONSTRAINT fk_user_rewards_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_rewards_reward
        FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
      INDEX idx_user_rewards_user (user_id, status)
    ) ENGINE=InnoDB`,
  );

  await ensureColumnExists('achievements', 'name', 'ALTER TABLE achievements ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT \'Achievement\' AFTER id');
  await ensureColumnExists('achievements', 'slug', 'ALTER TABLE achievements ADD COLUMN slug VARCHAR(140) NULL AFTER name');
  await ensureColumnExists('achievements', 'description', 'ALTER TABLE achievements ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT \'\' AFTER slug');
  await ensureColumnExists('achievements', 'xp_reward', 'ALTER TABLE achievements ADD COLUMN xp_reward INT NOT NULL DEFAULT 0 AFTER description');
  await ensureColumnExists('achievements', 'reward_id', 'ALTER TABLE achievements ADD COLUMN reward_id BIGINT NULL AFTER xp_reward');
  await ensureColumnExists('achievements', 'created_at', 'ALTER TABLE achievements ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER reward_id');
  await ensureColumnIsNullable('achievements', 'user_id', 'ALTER TABLE achievements MODIFY COLUMN user_id INT UNSIGNED NULL');
  await ensureColumnIsNullable('achievements', 'achievement_key', 'ALTER TABLE achievements MODIFY COLUMN achievement_key VARCHAR(100) NULL');
  await ensureColumnIsNullable('achievements', 'title', 'ALTER TABLE achievements MODIFY COLUMN title VARCHAR(255) NULL');
  await ensureColumnExists('achievement_rules', 'operator_symbol', 'ALTER TABLE achievement_rules ADD COLUMN operator_symbol ENUM(\'>=\', \'=\', \'<=\', \'>\', \'<\') NOT NULL DEFAULT \'>=\' AFTER condition_type');
  await ensureColumnExists('achievement_rules', 'timeframe_type', 'ALTER TABLE achievement_rules ADD COLUMN timeframe_type ENUM(\'lifetime\', \'daily\', \'weekly\', \'monthly\', \'program\', \'custom\') NOT NULL DEFAULT \'lifetime\' AFTER target_value');
  await ensureColumnExists('achievement_rules', 'timeframe_days', 'ALTER TABLE achievement_rules ADD COLUMN timeframe_days INT NULL AFTER timeframe_type');
  await ensureIndexExists('achievements', 'idx_achievements_reward', 'CREATE INDEX idx_achievements_reward ON achievements (reward_id)');
  await ensureIndexExists('achievements', 'uq_achievements_slug', 'CREATE UNIQUE INDEX uq_achievements_slug ON achievements (slug)');
  await ensureIndexExists('achievement_rules', 'idx_achievement_rules_achievement', 'CREATE INDEX idx_achievement_rules_achievement ON achievement_rules (achievement_id)');
  await ensureIndexExists('achievement_rules', 'idx_achievement_rules_type', 'CREATE INDEX idx_achievement_rules_type ON achievement_rules (condition_type)');
  await ensureIndexExists('user_achievements', 'idx_user_achievements_user', 'CREATE INDEX idx_user_achievements_user ON user_achievements (user_id)');
  await ensureIndexExists('user_achievements', 'idx_user_achievements_unlocked', 'CREATE INDEX idx_user_achievements_unlocked ON user_achievements (unlocked_at)');
  await ensureIndexExists('user_rewards', 'idx_user_rewards_user', 'CREATE INDEX idx_user_rewards_user ON user_rewards (user_id, status)');

  const [achievementSlugRows] = await pool.execute(
    `SELECT id, name, slug
     FROM achievements
     ORDER BY id ASC`,
  );
  const achievementSlugUpdates = buildSlugUpdates(achievementSlugRows, 'achievement');
  for (const update of achievementSlugUpdates) {
    await pool.execute(
      `UPDATE achievements
       SET slug = ?
       WHERE id = ?`,
      [update.slug, update.id],
    );
  }

  for (const achievement of ACHIEVEMENT_SEEDS) {
    await pool.execute(
      `INSERT INTO achievements (name, slug, description, xp_reward, reward_id)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM achievements WHERE slug = ?
       )`,
      [
        achievement.name,
        achievement.slug,
        achievement.description,
        achievement.xpReward,
        achievement.rewardId,
        achievement.slug,
      ],
    );

    const [achievementRows] = await pool.execute(
      `SELECT id
       FROM achievements
       WHERE slug = ?
       LIMIT 1`,
      [achievement.slug],
    );
    const achievementId = Number(achievementRows[0]?.id || 0);
    if (!achievementId) continue;

    for (const rule of achievement.rules) {
      await pool.execute(
        `INSERT INTO achievement_rules
           (achievement_id, condition_type, operator_symbol, target_value, timeframe_type)
         SELECT ?, ?, '>=', ?, 'lifetime'
         WHERE NOT EXISTS (
           SELECT 1
           FROM achievement_rules
           WHERE achievement_id = ?
             AND condition_type = ?
             AND operator_symbol = '>='
             AND target_value = ?
             AND timeframe_type = 'lifetime'
         )`,
        [
          achievementId,
          rule.conditionType,
          rule.targetValue,
          achievementId,
          rule.conditionType,
          rule.targetValue,
        ],
      );
    }
  }
};

const ensureAchievementInfrastructureOnce = async () => {
  if (!achievementInfrastructurePromise) {
    achievementInfrastructurePromise = ensureAchievementInfrastructure().catch((error) => {
      achievementInfrastructurePromise = null;
      throw error;
    });
  }
  return achievementInfrastructurePromise;
};

const grantAchievementReward = async ({ userId, achievementId, rewardId }) => {
  if (!rewardId) return [];

  const [existingRows] = await pool.execute(
    `SELECT id
     FROM user_rewards
     WHERE user_id = ? AND reward_id = ? AND source_type = 'achievement' AND source_id = ?
     LIMIT 1`,
    [userId, rewardId, achievementId],
  );

  if (existingRows.length) return [];

  await pool.execute(
    `INSERT INTO user_rewards
       (user_id, reward_id, source_type, source_id, status)
     VALUES (?, ?, 'achievement', ?, 'available')`,
    [userId, rewardId, achievementId],
  );

  const [rewardRows] = await pool.execute(
    `SELECT id, name, reward_type
     FROM rewards
     WHERE id = ?
     LIMIT 1`,
    [rewardId],
  );

  if (!rewardRows.length) return [];

  return [{
    id: Number(rewardRows[0].id),
    name: rewardRows[0].name || 'Reward',
    rewardType: rewardRows[0].reward_type || 'cosmetic',
    sourceType: 'achievement',
    sourceId: achievementId,
  }];
};

export const evaluateAndAwardAchievements = async ({ userId } = {}) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  await ensureAchievementInfrastructureOnce();

  const metrics = await collectUserProgressMetrics(normalizedUserId);
  const [badgeRows] = await pool.execute(
    `SELECT COUNT(*) AS total_badges
     FROM user_badges
     WHERE user_id = ?`,
    [normalizedUserId],
  );
  metrics.unlocked_badges = toFiniteNumber(badgeRows[0]?.total_badges, 0);

  const [rows] = await pool.execute(
    `SELECT
        a.id,
        a.name,
        a.slug,
        a.description,
        a.xp_reward,
        a.reward_id,
        ar.condition_type,
        ar.operator_symbol,
        ar.target_value
     FROM achievements a
     JOIN achievement_rules ar ON ar.achievement_id = a.id
     ORDER BY a.id ASC, ar.id ASC`,
  );

  const [existingRows] = await pool.execute(
    `SELECT achievement_id
     FROM user_achievements
     WHERE user_id = ?`,
    [normalizedUserId],
  );
  const unlockedAchievementIds = new Set(existingRows.map((row) => Number(row.achievement_id || 0)));

  const grouped = new Map();
  for (const row of rows) {
    const achievementId = Number(row.id);
    const existing = grouped.get(achievementId) || {
      achievement: {
        id: achievementId,
        name: row.name || 'Achievement',
        slug: row.slug || '',
        description: row.description || '',
        xpReward: Number(row.xp_reward || 0),
        rewardId: row.reward_id == null ? null : Number(row.reward_id),
      },
      rules: [],
    };

    existing.rules.push({
      conditionType: row.condition_type,
      operatorSymbol: row.operator_symbol || '>=',
      targetValue: Number(row.target_value || 0),
    });
    grouped.set(achievementId, existing);
  }

  const unlockedAchievements = [];
  const rewards = [];
  let xpFromAchievements = 0;

  for (const { achievement, rules } of grouped.values()) {
    const passed = rules.every((rule) => evaluateRule(
      toFiniteNumber(metrics[rule.conditionType], 0),
      rule.operatorSymbol,
      rule.targetValue,
    ));

    if (!passed || unlockedAchievementIds.has(achievement.id)) {
      continue;
    }

    await pool.execute(
      `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES (?, ?)`,
      [normalizedUserId, achievement.id],
    );

    const xpResult = await awardXpOnce({
      userId: normalizedUserId,
      sourceType: 'achievement_unlock',
      sourceId: achievement.id,
      xpAmount: achievement.xpReward,
      description: `Achievement unlocked: ${achievement.name}`,
    });

    xpFromAchievements += Number(xpResult.xpGained || 0);
    const grantedRewards = await grantAchievementReward({
      userId: normalizedUserId,
      achievementId: achievement.id,
      rewardId: achievement.rewardId,
    });
    rewards.push(...grantedRewards);

    unlockedAchievements.push({
      id: achievement.id,
      name: achievement.name,
      slug: achievement.slug,
      description: achievement.description,
      xpAwarded: Number(xpResult.xpGained || 0),
      rewardId: achievement.rewardId,
    });
  }

  return {
    userId: normalizedUserId,
    metrics,
    unlockedAchievements,
    xpFromAchievements,
    rewards,
  };
};
