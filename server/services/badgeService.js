/* eslint-env node */
import pool from '../database.js';
import { awardXpOnce, getUserXpSummary } from './xpService.js';
import { BADGE_CATEGORIES, BADGE_SEEDS } from './badgeCatalog.js';

let badgeInfrastructurePromise = null;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLIDAY_MM_DD = new Set(['01-01', '02-14', '07-04', '10-31', '11-11', '12-24', '12-25', '12-31']);
const CONDITION_TYPES = Array.from(new Set(
  BADGE_SEEDS
    .flatMap((badge) => (Array.isArray(badge.rules) ? badge.rules : []))
    .map((rule) => String(rule?.conditionType || '').trim())
    .filter(Boolean),
));

const normalizeUserId = (userId) => {
  const value = Number(userId);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

const toFiniteNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const safeScalar = async (sql, params = [], field = 'value') => {
  try {
    const [rows] = await pool.execute(sql, params);
    return toFiniteNumber(rows[0]?.[field], 0);
  } catch {
    return 0;
  }
};

const safeRows = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const toDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeExerciseName = (value) => String(value || '').trim().toLowerCase();

const inferMuscleGroups = (exerciseName) => {
  const key = normalizeExerciseName(exerciseName);
  if (!key) return [];
  const groups = [];
  if (/bench|chest|fly|push-up|push up|press/.test(key)) groups.push('chest', 'triceps', 'shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover|chin-up|chin up/.test(key)) groups.push('back', 'biceps', 'forearms');
  if (/squat|leg press|lunge|split squat|step up|hamstring|quad|calf|glute|rdl/.test(key)) groups.push('legs');
  if (/shoulder|overhead press|lateral raise|rear delt/.test(key)) groups.push('shoulders');
  if (/curl|biceps/.test(key)) groups.push('biceps');
  if (/tricep|skull crusher|dip/.test(key)) groups.push('triceps');
  return [...new Set(groups)];
};

const getPrTags = (exerciseName, weight) => {
  const key = normalizeExerciseName(exerciseName);
  const tags = new Set();

  if (/bench|incline bench|decline bench|chest press/.test(key)) tags.add('bench');
  if (/squat/.test(key)) tags.add('squat');
  if (/deadlift|romanian deadlift|rdl/.test(key)) tags.add('deadlift');
  if (/overhead press|shoulder press|military press/.test(key)) tags.add('overhead');
  if ((/pull-up|pull up|chin-up|chin up/.test(key)) && Number(weight || 0) > 0) tags.add('weighted_pullup');
  if (/leg press/.test(key)) tags.add('leg_press');
  if (/dumbbell/.test(key) && /press/.test(key)) tags.add('dumbbell_press');

  if (/squat|deadlift|rdl|leg|lunge|hamstring|quad|calf|glute/.test(key)) tags.add('lower');
  if (/bench|press|row|pull-up|pull up|chin-up|chin up|curl|tricep|shoulder|lat/.test(key)) tags.add('upper');

  return [...tags];
};

const getIsoWeekStartKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

const toMonthKey = (value) => {
  const key = toDateKey(value);
  return key ? key.slice(0, 7) : '';
};

const parseDateKey = (value) => {
  const key = String(value || '').slice(0, 10);
  if (!key) return null;
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isHolidayKey = (dateKey) => {
  const key = String(dateKey || '').slice(5, 10);
  return HOLIDAY_MM_DD.has(key);
};

const getMaxConsecutiveDays = (dateKeys) => {
  const uniqueSorted = [...new Set((Array.isArray(dateKeys) ? dateKeys : []).filter(Boolean))].sort();
  if (!uniqueSorted.length) return 0;

  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = parseDateKey(uniqueSorted[i - 1]);
    const cur = parseDateKey(uniqueSorted[i]);
    if (!prev || !cur) continue;
    const diff = Math.round((cur.getTime() - prev.getTime()) / MS_PER_DAY);
    if (diff === 1) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    } else if (diff > 1) {
      currentRun = 1;
    }
  }
  return maxRun;
};

const ensureBadgeInfrastructure = async () => {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS badge_categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(80) NOT NULL UNIQUE,
      description VARCHAR(255) NULL
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS badges (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      category_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(140) NOT NULL UNIQUE,
      description VARCHAR(255) NOT NULL,
      icon_url VARCHAR(255) NULL,
      rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common',
      is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
      xp_reward INT NOT NULL DEFAULT 0,
      points_reward INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_badges_category
        FOREIGN KEY (category_id) REFERENCES badge_categories(id) ON DELETE RESTRICT,
      INDEX idx_badges_category (category_id),
      INDEX idx_badges_hidden (is_hidden)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS badge_rules (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      badge_id BIGINT NOT NULL,
      condition_type VARCHAR(80) NOT NULL,
      operator_symbol ENUM('>=', '=', '<=', '>', '<') NOT NULL DEFAULT '>=',
      target_value DECIMAL(12,2) NOT NULL,
      secondary_value DECIMAL(12,2) NULL,
      timeframe_type ENUM('lifetime', 'daily', 'weekly', 'monthly', 'program', 'custom') NOT NULL DEFAULT 'lifetime',
      timeframe_days INT NULL,
      stack_group VARCHAR(80) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_badge_rules_badge
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
      INDEX idx_badge_rules_badge (badge_id),
      INDEX idx_badge_rules_type (condition_type)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_badges (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      badge_id BIGINT NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      progress_value DECIMAL(12,2) NOT NULL DEFAULT 0,
      is_seen BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE KEY uq_user_badge (user_id, badge_id),
      CONSTRAINT fk_user_badges_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_badges_badge
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
      INDEX idx_user_badges_user (user_id),
      INDEX idx_user_badges_unlocked (unlocked_at)
    ) ENGINE=InnoDB`,
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS user_badge_progress (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      badge_id BIGINT NOT NULL,
      current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
      target_value DECIMAL(12,2) NOT NULL,
      percent_complete DECIMAL(5,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_badge_progress (user_id, badge_id),
      CONSTRAINT fk_user_badge_progress_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_badge_progress_badge
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
      INDEX idx_user_badge_progress_user (user_id)
    ) ENGINE=InnoDB`,
  );

  for (const [name, description] of BADGE_CATEGORIES) {
    await pool.execute(
      `INSERT INTO badge_categories (name, description)
       SELECT ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM badge_categories WHERE name = ?
       )`,
      [name, description, name],
    );
  }

  const [categoryRows] = await pool.execute(
    `SELECT id, name
     FROM badge_categories
     WHERE name IN (${BADGE_CATEGORIES.map(() => '?').join(', ')})`,
    BADGE_CATEGORIES.map(([name]) => name),
  );
  const categoryIdByName = new Map(categoryRows.map((row) => [String(row.name || ''), Number(row.id)]));

  for (const badge of BADGE_SEEDS) {
    const categoryId = categoryIdByName.get(badge.category);
    if (!categoryId) continue;

    await pool.execute(
      `INSERT INTO badges
         (category_id, name, slug, description, rarity, is_hidden, xp_reward, points_reward, active)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM badges WHERE slug = ?
       )`,
      [
        categoryId,
        badge.name,
        badge.slug,
        badge.description,
        badge.rarity,
        badge.isHidden ? 1 : 0,
        badge.xpReward,
        badge.pointsReward,
        badge.slug,
      ],
    );

    const [badgeRows] = await pool.execute(
      `SELECT id
       FROM badges
       WHERE slug = ?
       LIMIT 1`,
      [badge.slug],
    );
    const badgeId = Number(badgeRows[0]?.id || 0);
    if (!badgeId) continue;

    for (const rule of badge.rules) {
      const operatorSymbol = String(rule.operatorSymbol || '>=');
      const timeframeType = String(rule.timeframeType || 'lifetime');
      const timeframeDays = rule.timeframeDays == null ? null : Number(rule.timeframeDays);
      await pool.execute(
        `INSERT INTO badge_rules
           (badge_id, condition_type, operator_symbol, target_value, timeframe_type, timeframe_days)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1
           FROM badge_rules
           WHERE badge_id = ?
             AND condition_type = ?
             AND operator_symbol = ?
             AND target_value = ?
             AND timeframe_type = ?
             AND (
               (timeframe_days IS NULL AND ? IS NULL)
               OR timeframe_days = ?
             )
         )`,
        [
          badgeId,
          rule.conditionType,
          operatorSymbol,
          rule.targetValue,
          timeframeType,
          timeframeDays,
          badgeId,
          rule.conditionType,
          operatorSymbol,
          rule.targetValue,
          timeframeType,
          timeframeDays,
          timeframeDays,
        ],
      );
    }
  }
};

const ensureBadgeInfrastructureOnce = async () => {
  if (!badgeInfrastructurePromise) {
    badgeInfrastructurePromise = ensureBadgeInfrastructure().catch((error) => {
      badgeInfrastructurePromise = null;
      throw error;
    });
  }
  return badgeInfrastructurePromise;
};

const evaluateRule = (value, operatorSymbol, targetValue) => {
  if (operatorSymbol === '=') return value === targetValue;
  if (operatorSymbol === '<=') return value <= targetValue;
  if (operatorSymbol === '<') return value < targetValue;
  if (operatorSymbol === '>') return value > targetValue;
  return value >= targetValue;
};

const computeRulePercent = (value, operatorSymbol, targetValue) => {
  const current = toFiniteNumber(value, 0);
  const target = Math.max(0, toFiniteNumber(targetValue, 0));

  if (operatorSymbol === '=' && target > 0) {
    return Math.max(0, Math.min(100, 100 - (Math.abs(current - target) / target) * 100));
  }

  if (operatorSymbol === '<=' || operatorSymbol === '<') {
    return current <= target ? 100 : 0;
  }

  if (target <= 0) return 100;
  return Math.max(0, Math.min(100, (current / target) * 100));
};

export const collectUserProgressMetrics = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  const xpSummary = await getUserXpSummary(normalizedUserId);

  const [
    workoutsCompleted,
    trainingDays,
    workoutDaysLast3,
    recoveryLogsTotal,
    sleepLogsTotal,
    nutritionLogsTotal,
    completedMissions,
    completedChallenges,
    plannedWorkoutsCompleted,
    lateNightWorkouts,
    midnightWorkouts,
    workoutsBefore5,
    workoutsBefore6,
    workoutsBefore7,
    workoutsBetween12And14,
    workoutsAfter19,
    workoutsAfter22,
    comebackWorkouts,
    workoutSessionMaxMinutes,
    quickWorkoutsUnder20,
    weekendDualDays,
    sundayMorningWorkouts,
    doubleSessionDays,
    tripleSessionDays,
    noDaysOffWeeks,
    weeksWithWorkout,
    monthsWithWorkout,
    sessionVolumeKg,
    weekVolumeKg,
    monthVolumeKg,
    lifetimeVolumeKg,
    sessionSetsCount,
    friendsTotal,
    workoutSharesFromPosts,
    communityCommentsTotal,
    likesReceivedTotal,
    hiddenBadgesUnlocked,
    unlockedBadges,
    scheduledSessionsNoMiss60d,
    totalPoints,
    challengesJoinedTotal,
    challengeTemplatesCreated,
    goalsCreatedFromGoalsTable,
    goalsCompletedFromGoalsTable,
    goalsCreatedFromUserGoals,
    goalsCompletedFromUserGoals,
    sledPushChallengesCompleted,
    workoutShareLikesSinglePost20,
    completedProgramsTotal,
  ] = await Promise.all([
    safeScalar(
      `SELECT COUNT(
          DISTINCT COALESCE(
            CONCAT('session:', session_id),
            CONCAT('day_exercise:', DATE(created_at), '|', LOWER(TRIM(exercise_name)))
          )
        ) AS value
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS value
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS value
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS value
       FROM recovery_history
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS value
       FROM recovery_history
       WHERE user_id = ? AND sleep_hours IS NOT NULL`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS value
       FROM recovery_history
       WHERE user_id = ? AND nutrition_quality IS NOT NULL`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_missions
       WHERE user_id = ? AND status = 'completed'`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_challenges
       WHERE user_id = ? AND status = 'completed'`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND program_assignment_id IS NOT NULL`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND (HOUR(completed_at) >= 23 OR HOUR(completed_at) < 5)`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) = 0`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) < 5`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) < 6`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) < 7`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) BETWEEN 12 AND 13`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) >= 19`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND HOUR(completed_at) >= 22`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions ws
       WHERE ws.user_id = ?
         AND ws.status = 'completed'
         AND ws.completed_at IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM missed_program_days mpd
           WHERE mpd.user_id = ws.user_id
             AND mpd.missed_date < DATE(ws.completed_at)
             AND mpd.missed_date >= DATE_SUB(DATE(ws.completed_at), INTERVAL 14 DAY)
         )`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(MAX(duration_seconds), 0) / 60 AS value
       FROM workout_sessions
       WHERE user_id = ? AND status = 'completed' AND duration_seconds > 0`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND duration_seconds > 0
         AND duration_seconds <= 1200`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT YEARWEEK(completed_at, 1) AS yw, COUNT(DISTINCT WEEKDAY(completed_at)) AS weekend_days
         FROM workout_sessions
         WHERE user_id = ?
           AND status = 'completed'
           AND completed_at IS NOT NULL
           AND WEEKDAY(completed_at) IN (5, 6)
         GROUP BY YEARWEEK(completed_at, 1)
       ) t
       WHERE t.weekend_days = 2`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM workout_sessions
       WHERE user_id = ?
         AND status = 'completed'
         AND completed_at IS NOT NULL
         AND WEEKDAY(completed_at) = 6
         AND HOUR(completed_at) < 12`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT DATE(completed_at) AS d, COUNT(*) AS sessions_per_day
         FROM workout_sessions
         WHERE user_id = ?
           AND status = 'completed'
           AND completed_at IS NOT NULL
         GROUP BY DATE(completed_at)
       ) t
       WHERE t.sessions_per_day >= 2`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT DATE(completed_at) AS d, COUNT(*) AS sessions_per_day
         FROM workout_sessions
         WHERE user_id = ?
           AND status = 'completed'
           AND completed_at IS NOT NULL
         GROUP BY DATE(completed_at)
       ) t
       WHERE t.sessions_per_day >= 3`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT YEARWEEK(created_at, 1) AS yw, COUNT(DISTINCT DATE(created_at)) AS active_days
         FROM workout_sets
         WHERE user_id = ? AND completed = 1
         GROUP BY YEARWEEK(created_at, 1)
       ) t
       WHERE t.active_days = 7`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT YEARWEEK(created_at, 1)) AS value
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE_FORMAT(created_at, '%Y-%m')) AS value
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(MAX(session_volume), 0) AS value
       FROM (
         SELECT COALESCE(session_id, CONCAT('day:', DATE(created_at))) AS session_key,
                SUM(GREATEST(COALESCE(weight, 0), 0) * GREATEST(COALESCE(reps, 0), 0)) AS session_volume
         FROM workout_sets
         WHERE user_id = ? AND completed = 1
         GROUP BY session_key
       ) t`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(MAX(week_volume), 0) AS value
       FROM (
         SELECT YEARWEEK(created_at, 1) AS yw,
                SUM(GREATEST(COALESCE(weight, 0), 0) * GREATEST(COALESCE(reps, 0), 0)) AS week_volume
         FROM workout_sets
         WHERE user_id = ? AND completed = 1
         GROUP BY YEARWEEK(created_at, 1)
       ) t`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(MAX(month_volume), 0) AS value
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym,
                SUM(GREATEST(COALESCE(weight, 0), 0) * GREATEST(COALESCE(reps, 0), 0)) AS month_volume
         FROM workout_sets
         WHERE user_id = ? AND completed = 1
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ) t`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(SUM(GREATEST(COALESCE(weight, 0), 0) * GREATEST(COALESCE(reps, 0), 0)), 0) AS value
       FROM workout_sets
       WHERE user_id = ? AND completed = 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(MAX(session_sets), 0) AS value
       FROM (
         SELECT COALESCE(session_id, CONCAT('day:', DATE(created_at))) AS session_key,
                COUNT(*) AS session_sets
         FROM workout_sets
         WHERE user_id = ? AND completed = 1
         GROUP BY session_key
       ) t`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM friendships
       WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'`,
      [normalizedUserId, normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM blog_posts
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM blog_post_comments
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT post_id, user_id
         FROM blog_post_likes
         UNION
         SELECT post_id, user_id
         FROM blog_post_reactions
       ) br
       JOIN blog_posts bp ON bp.id = br.post_id
       WHERE bp.user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ? AND b.is_hidden = TRUE`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_badges
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT CASE
         WHEN EXISTS (
           SELECT 1
           FROM program_assignments pa
           WHERE pa.user_id = ?
             AND pa.status = 'active'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM missed_program_days mpd
           WHERE mpd.user_id = ?
             AND mpd.missed_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
         )
         THEN 1 ELSE 0 END AS value`,
      [normalizedUserId, normalizedUserId],
    ),
    safeScalar(
      `SELECT COALESCE(total_points, 0) AS value
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_challenges
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM challenge_templates
       WHERE created_by_user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM goals
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM goals
       WHERE user_id = ?
         AND status IN ('completed', 'done', 'achieved')`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_goals
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_goals
       WHERE user_id = ?
         AND status IN ('completed', 'done', 'achieved')`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM user_challenges uc
       JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
       WHERE uc.user_id = ?
         AND uc.status = 'completed'
         AND LOWER(COALESCE(ct.title, '')) LIKE '%sled%'`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT CASE
         WHEN COALESCE(MAX(post_likes.like_count), 0) >= 20 THEN 1
         ELSE 0
       END AS value
       FROM blog_posts bp
       LEFT JOIN (
         SELECT post_id, COUNT(*) AS like_count
         FROM (
           SELECT post_id, user_id
           FROM blog_post_likes
           UNION
           SELECT post_id, user_id
           FROM blog_post_reactions
         ) br
         GROUP BY post_id
       ) post_likes ON post_likes.post_id = bp.id
       WHERE bp.user_id = ?`,
      [normalizedUserId],
    ),
    safeScalar(
      `SELECT COUNT(*) AS value
       FROM program_assignments
       WHERE user_id = ?
         AND status IN ('completed', 'finished', 'done')`,
      [normalizedUserId],
    ),
  ]);

  const workoutDates = await safeRows(
    `SELECT DISTINCT DATE(created_at) AS workout_day
     FROM workout_sets
     WHERE user_id = ? AND completed = 1
     ORDER BY workout_day DESC
     LIMIT 400`,
    [normalizedUserId],
  );

  const [
    allSetRows,
    recoveryHistoryRows,
    snapshotRows,
    xpEventRows,
    planAdaptationRows,
    missedProgramRows,
    blogActivityRows,
    recoveryFactorRows,
  ] = await Promise.all([
    safeRows(
      `SELECT id, session_id, exercise_name, set_number, COALESCE(weight, 0) AS weight, COALESCE(reps, 0) AS reps, completed, created_at
       FROM workout_sets
       WHERE user_id = ?
       ORDER BY created_at ASC, id ASC`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT recorded_at, overall_recovery_score, sleep_hours, nutrition_quality
       FROM recovery_history
       WHERE user_id = ?
       ORDER BY recorded_at ASC`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT snapshot_date, hours_sleep, hydration_liters, weight_kg, bmi
       FROM user_health_snapshots
       WHERE user_id = ?
       ORDER BY snapshot_date ASC`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT source_type, source_id, created_at
       FROM xp_transactions
       WHERE user_id = ?
       ORDER BY created_at ASC, id ASC`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT adaptation_date, trigger_source
       FROM plan_adaptations
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT missed_date
       FROM missed_program_days
       WHERE user_id = ?`,
      [normalizedUserId],
    ),
    safeRows(
      `SELECT activity_day
       FROM (
         SELECT DATE(created_at) AS activity_day
         FROM blog_posts
         WHERE user_id = ?
         UNION ALL
         SELECT DATE(created_at) AS activity_day
         FROM blog_post_comments
         WHERE user_id = ?
         UNION ALL
         SELECT DATE(bpl.created_at) AS activity_day
         FROM blog_post_likes bpl
         JOIN blog_posts bp ON bp.id = bpl.post_id
         WHERE bpl.user_id = ?
         UNION ALL
         SELECT DATE(bpr.created_at) AS activity_day
         FROM blog_post_reactions bpr
         JOIN blog_posts bp ON bp.id = bpr.post_id
         WHERE bpr.user_id = ?
       ) x`,
      [normalizedUserId, normalizedUserId, normalizedUserId, normalizedUserId],
    ),
    safeRows(
      `SELECT protein_intake
       FROM recovery_factors
       WHERE user_id = ?
       LIMIT 1`,
      [normalizedUserId],
    ),
  ]);

  const dateSet = new Set(
    workoutDates
      .map((row) => toDateKey(row.workout_day))
      .filter(Boolean),
  );

  let trainingStreakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    trainingStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const [plannedRows] = await Promise.all([
    safeRows(
      `SELECT
          COALESCE(COUNT(DISTINCT pw.day_name), 0) AS planned_days_per_week
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       JOIN program_workouts pw ON pw.program_id = p.id
       WHERE pa.user_id = ?
         AND pa.status = 'active'`,
      [normalizedUserId],
    ),
  ]);
  const plannedDaysPerWeek = Math.max(0, Number(plannedRows[0]?.planned_days_per_week || 0));

  const completedPlannedDaysWeek = await safeScalar(
    `SELECT COUNT(DISTINCT DATE(completed_at)) AS value
     FROM workout_sessions
     WHERE user_id = ?
       AND status = 'completed'
       AND program_assignment_id IS NOT NULL
       AND YEARWEEK(completed_at, 1) = YEARWEEK(CURDATE(), 1)`,
    [normalizedUserId],
  );

  const completedPlannedDaysMonth = await safeScalar(
    `SELECT COUNT(DISTINCT DATE(completed_at)) AS value
     FROM workout_sessions
     WHERE user_id = ?
       AND status = 'completed'
       AND program_assignment_id IS NOT NULL
       AND DATE_FORMAT(completed_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [normalizedUserId],
  );

  const plannedWorkoutCompletionWeek = plannedDaysPerWeek > 0 && completedPlannedDaysWeek >= plannedDaysPerWeek ? 1 : 0;
  const plannedDaysPerMonth = plannedDaysPerWeek > 0 ? plannedDaysPerWeek * 4 : 0;
  const plannedWorkoutCompletionMonth = plannedDaysPerMonth > 0 && completedPlannedDaysMonth >= plannedDaysPerMonth ? 1 : 0;

  const xpTypeCounts = new Map();
  const xpTypeDates = new Map();
  for (const row of xpEventRows) {
    const sourceType = String(row?.source_type || '').trim();
    if (!sourceType) continue;
    xpTypeCounts.set(sourceType, Number(xpTypeCounts.get(sourceType) || 0) + 1);
    const dateKey = toDateKey(row?.created_at);
    if (!dateKey) continue;
    const dateSetForType = xpTypeDates.get(sourceType) || new Set();
    dateSetForType.add(dateKey);
    xpTypeDates.set(sourceType, dateSetForType);
  }

  const completedSetRows = allSetRows.filter((row) => Number(row?.completed || 0) === 1);
  const prBestByExercise = new Map();
  const prDayCounts = new Map();
  const prWeekKeys = new Set();
  const prMonthCounts = new Map();
  const prUpperBySession = new Map();
  const prLowerBySession = new Map();

  const weeklyMuscleSets = new Map();
  const burpeesBySession = new Map();
  const ropeBySession = new Map();
  const runSessions = new Set();
  const cyclingSessions = new Set();
  const rowingSessions = new Set();

  let benchPrCount = 0;
  let squatPrCount = 0;
  let deadliftPrCount = 0;
  let overheadPressPrCount = 0;
  let weightedPullupPrCount = 0;
  let legPressPrCount = 0;
  let dumbbellPressPrCount = 0;
  let weekendPrs = 0;
  let prsLifetime = 0;

  let pushupRepsLifetime = 0;
  let pullupRepsLifetime = 0;
  let bodyweightSquatsLifetime = 0;
  let dipRepsLifetime = 0;
  let coreRepsLifetime = 0;
  let runDistanceSingleKm = 0;
  let cyclingDistanceSingleKm = 0;
  let rowDistanceSingleM = 0;

  const toSessionKey = (row) => {
    const dayKey = toDateKey(row?.created_at) || 'unknown';
    return row?.session_id != null && Number(row.session_id) > 0
      ? `session:${Number(row.session_id)}`
      : `day:${dayKey}`;
  };

  for (const row of completedSetRows) {
    const exerciseName = String(row?.exercise_name || '');
    const key = normalizeExerciseName(exerciseName);
    const dateKey = toDateKey(row?.created_at);
    if (!dateKey) continue;
    const sessionKey = toSessionKey(row);
    const reps = Math.max(0, toFiniteNumber(row?.reps, 0));
    const weight = Math.max(0, toFiniteNumber(row?.weight, 0));
    const weekKey = getIsoWeekStartKey(dateKey);

    const weekly = weeklyMuscleSets.get(weekKey) || { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0 };
    const groups = inferMuscleGroups(exerciseName);
    if (groups.includes('chest')) weekly.chest += 1;
    if (groups.includes('back')) weekly.back += 1;
    if (groups.includes('legs')) weekly.legs += 1;
    if (groups.includes('shoulders')) weekly.shoulders += 1;
    if (groups.includes('biceps') || groups.includes('triceps')) weekly.arms += 1;
    weeklyMuscleSets.set(weekKey, weekly);

    if (/push-up|push up/.test(key)) pushupRepsLifetime += reps;
    if (/pull-up|pull up|chin-up|chin up/.test(key)) pullupRepsLifetime += reps;
    if (/squat/.test(key) && weight <= 0.001) bodyweightSquatsLifetime += reps;
    if (/dip/.test(key)) dipRepsLifetime += reps;
    if (/plank|crunch|sit-up|sit up|ab|core|leg raise/.test(key)) coreRepsLifetime += reps;

    if (/burpee/.test(key)) burpeesBySession.set(sessionKey, Number(burpeesBySession.get(sessionKey) || 0) + reps);
    if (/jump rope|jumprope|rope/.test(key)) ropeBySession.set(sessionKey, Number(ropeBySession.get(sessionKey) || 0) + reps);
    if (/run|jog|treadmill/.test(key)) {
      runSessions.add(sessionKey);
      runDistanceSingleKm = Math.max(runDistanceSingleKm, reps >= 200 ? reps / 1000 : reps);
    }
    if (/cycle|cycling|bike|biking|spinning/.test(key)) {
      cyclingSessions.add(sessionKey);
      cyclingDistanceSingleKm = Math.max(cyclingDistanceSingleKm, reps >= 200 ? reps / 1000 : reps);
    }
    if (/row|rowing/.test(key)) {
      rowingSessions.add(sessionKey);
      rowDistanceSingleM = Math.max(rowDistanceSingleM, reps <= 20 ? reps * 1000 : reps);
    }

    const prScore = weight > 0 ? (weight * (1 + Math.min(reps, 50) / 30)) : reps;
    if (prScore <= 0) continue;

    const previousBest = Number(prBestByExercise.get(key) || 0);
    if (prScore <= previousBest + 0.0001) {
      prBestByExercise.set(key, Math.max(previousBest, prScore));
      continue;
    }
    prBestByExercise.set(key, prScore);

    const tags = getPrTags(exerciseName, weight);
    prsLifetime += 1;
    if (tags.includes('bench')) benchPrCount += 1;
    if (tags.includes('squat')) squatPrCount += 1;
    if (tags.includes('deadlift')) deadliftPrCount += 1;
    if (tags.includes('overhead')) overheadPressPrCount += 1;
    if (tags.includes('weighted_pullup')) weightedPullupPrCount += 1;
    if (tags.includes('leg_press')) legPressPrCount += 1;
    if (tags.includes('dumbbell_press')) dumbbellPressPrCount += 1;
    if (tags.includes('upper')) prUpperBySession.set(sessionKey, Number(prUpperBySession.get(sessionKey) || 0) + 1);
    if (tags.includes('lower')) prLowerBySession.set(sessionKey, Number(prLowerBySession.get(sessionKey) || 0) + 1);

    const dayCount = Number(prDayCounts.get(dateKey) || 0) + 1;
    prDayCounts.set(dateKey, dayCount);
    prWeekKeys.add(getIsoWeekStartKey(dateKey));
    const monthKey = toMonthKey(dateKey);
    prMonthCounts.set(monthKey, Number(prMonthCounts.get(monthKey) || 0) + 1);

    const day = parseDateKey(dateKey);
    if (day && (day.getUTCDay() === 0 || day.getUTCDay() === 6)) weekendPrs += 1;
  }

  const maxWeeklySet = (groupName) => Math.max(
    0,
    ...Array.from(weeklyMuscleSets.values()).map((row) => Number(row[groupName] || 0)),
  );

  const lowerBodyPrsSingleSession = Math.max(0, ...Array.from(prLowerBySession.values()).map((v) => Number(v || 0)));
  const upperBodyPrsSingleSession = Math.max(0, ...Array.from(prUpperBySession.values()).map((v) => Number(v || 0)));
  const prsMonth = Math.max(0, ...Array.from(prMonthCounts.values()).map((v) => Number(v || 0)));
  const doublePrDays = Array.from(prDayCounts.values()).filter((count) => count >= 2).length;
  const triplePrDays = Array.from(prDayCounts.values()).filter((count) => count >= 3).length;
  const sortedPrWeeks = [...prWeekKeys].sort();
  let prStreakWeeks = 0;
  let currentPrStreak = 0;
  for (let i = 0; i < sortedPrWeeks.length; i += 1) {
    if (i === 0) {
      currentPrStreak = 1;
      prStreakWeeks = 1;
      continue;
    }
    const prev = parseDateKey(sortedPrWeeks[i - 1]);
    const cur = parseDateKey(sortedPrWeeks[i]);
    const diff = (!prev || !cur) ? 999 : Math.round((cur.getTime() - prev.getTime()) / MS_PER_DAY);
    if (diff === 7) {
      currentPrStreak += 1;
      prStreakWeeks = Math.max(prStreakWeeks, currentPrStreak);
    } else if (diff > 7) {
      currentPrStreak = 1;
    }
  }

  const burpeesSingleSession = Math.max(0, ...Array.from(burpeesBySession.values()).map((v) => Number(v || 0)));
  const jumpRopeSingleSession = Math.max(0, ...Array.from(ropeBySession.values()).map((v) => Number(v || 0)));
  const tripleBigLiftPrs = benchPrCount > 0 && squatPrCount > 0 && deadliftPrCount > 0 ? 1 : 0;

  const sleepDateSet = new Set(
    recoveryHistoryRows
      .filter((row) => row?.sleep_hours != null)
      .map((row) => toDateKey(row?.recorded_at))
      .filter(Boolean),
  );
  const nutritionDateSet = new Set(
    recoveryHistoryRows
      .filter((row) => row?.nutrition_quality != null)
      .map((row) => toDateKey(row?.recorded_at))
      .filter(Boolean),
  );
  const hydrationDateSet = new Set(
    snapshotRows
      .filter((row) => row?.hydration_liters != null)
      .map((row) => toDateKey(row?.snapshot_date))
      .filter(Boolean),
  );

  for (const d of (xpTypeDates.get('sleep') || [])) sleepDateSet.add(d);
  for (const d of (xpTypeDates.get('nutrition') || [])) nutritionDateSet.add(d);
  for (const d of (xpTypeDates.get('hydration') || [])) hydrationDateSet.add(d);

  const sleepAndTrainDays = [...sleepDateSet].filter((d) => dateSet.has(d)).length;
  const sleepLogsComputed = Math.max(Number(sleepLogsTotal || 0), sleepDateSet.size, Number(xpTypeCounts.get('sleep') || 0));
  const nutritionLogsComputed = Math.max(Number(nutritionLogsTotal || 0), nutritionDateSet.size, Number(xpTypeCounts.get('nutrition') || 0));
  const hydrationLogsComputed = Math.max(hydrationDateSet.size, Number(xpTypeCounts.get('hydration') || 0));
  const proteinIntake = toFiniteNumber(recoveryFactorRows[0]?.protein_intake, 0);
  const proteinTargetDays = proteinIntake >= 1.6 ? nutritionDateSet.size : Number(xpTypeCounts.get('nutrition') || 0);

  const lowRecoveryDates = new Set(
    recoveryHistoryRows
      .filter((row) => toFiniteNumber(row?.overall_recovery_score, 0) > 0 && toFiniteNumber(row?.overall_recovery_score, 0) < 45)
      .map((row) => toDateKey(row?.recorded_at))
      .filter(Boolean),
  );
  const smartRestDecisions = [...lowRecoveryDates].filter((d) => !dateSet.has(d)).length;
  const recoveryComebackImproved = Math.min(1, smartRestDecisions > 0 && trainingStreakDays > 0 ? 1 : 0);

  const blogActivityDates = new Set(
    blogActivityRows
      .map((row) => toDateKey(row?.activity_day))
      .filter(Boolean),
  );
  for (const d of (xpTypeDates.get('share') || [])) blogActivityDates.add(d);
  const communityActiveDays = blogActivityDates.size;
  const workoutDateKeys = [...dateSet].sort();
  const soloSessionDays = workoutDateKeys.filter((d) => !blogActivityDates.has(d)).length;
  const soloSessionStreak10 = getMaxConsecutiveDays(workoutDateKeys.filter((d) => !blogActivityDates.has(d))) >= 10 ? 1 : 0;

  const weightRows = snapshotRows
    .map((row) => ({
      dateKey: toDateKey(row?.snapshot_date),
      weightKg: toFiniteNumber(row?.weight_kg, null),
      bmi: toFiniteNumber(row?.bmi, null),
    }))
    .filter((row) => row.dateKey && row.weightKg != null);
  let weightGainKg = 0;
  let weightLossKg = 0;
  let bodyFatDropPercent = 0;
  if (weightRows.length >= 2) {
    const first = weightRows[0];
    const last = weightRows[weightRows.length - 1];
    weightGainKg = Math.max(0, Number((last.weightKg - first.weightKg).toFixed(2)));
    weightLossKg = Math.max(0, Number((first.weightKg - last.weightKg).toFixed(2)));
    if (first.bmi != null && last.bmi != null) {
      bodyFatDropPercent = Math.max(0, Number((first.bmi - last.bmi).toFixed(2)));
    }
  }

  const workoutSharesTotal = Math.max(Number(workoutSharesFromPosts || 0), Number(xpTypeCounts.get('share') || 0));
  const referralsTotal = Number(xpTypeCounts.get('referral') || 0);
  const progressPhotosTotal = Number(xpTypeCounts.get('progress_photo') || 0);
  const goalsCreatedTotal = Math.max(0, Number(goalsCreatedFromGoalsTable || 0), Number(goalsCreatedFromUserGoals || 0));
  const goalsCompletedTotal = Math.max(0, Number(goalsCompletedFromGoalsTable || 0), Number(goalsCompletedFromUserGoals || 0));
  const completedProgramFlag = Number(completedProgramsTotal || 0) > 0 || Number(xpTypeCounts.get('program_complete') || 0) > 0 ? 1 : 0;
  const weeklyTargetPlusTwo = plannedDaysPerWeek > 0 && weeksWithWorkout >= 1 ? 1 : 0;
  const holidayWorkouts = workoutDateKeys.filter((dateKey) => isHolidayKey(dateKey)).length;
  const nearSkipDaysTrained = missedProgramRows.filter((row) => {
    const missed = parseDateKey(toDateKey(row?.missed_date));
    if (!missed) return false;
    const nextDay = new Date(missed.getTime() + MS_PER_DAY).toISOString().slice(0, 10);
    return dateSet.has(nextDay);
  }).length;
  const deloadWeeksCompleted = new Set(
    planAdaptationRows
      .filter((row) => String(row?.trigger_source || '').toLowerCase() === 'auto_deload')
      .map((row) => getIsoWeekStartKey(toDateKey(row?.adaptation_date) || ''))
      .filter(Boolean),
  ).size;

  const defaults = Object.fromEntries(CONDITION_TYPES.map((key) => [key, 0]));
  const computedMetrics = {
    workouts_completed: workoutsCompleted,
    training_days: trainingDays,
    workout_days_last_3: workoutDaysLast3,
    training_streak_days: trainingStreakDays,
    recovery_logs_total: recoveryLogsTotal,
    sleep_logs_total: sleepLogsComputed,
    nutrition_logs_total: nutritionLogsComputed,
    hydration_logs_total: hydrationLogsComputed,
    protein_target_days: proteinTargetDays,
    completed_missions: completedMissions,
    completed_challenges: completedChallenges,
    planned_workouts_completed: plannedWorkoutsCompleted,
    planned_workout_completion_week: plannedWorkoutCompletionWeek,
    planned_workout_completion_month: plannedWorkoutCompletionMonth,
    late_night_workouts: lateNightWorkouts,
    midnight_workouts: midnightWorkouts,
    workouts_before_5: workoutsBefore5,
    workouts_before_6: workoutsBefore6,
    workouts_before_7: workoutsBefore7,
    workouts_between_12_14: workoutsBetween12And14,
    workouts_after_19: workoutsAfter19,
    workouts_after_22: workoutsAfter22,
    sunday_morning_workouts: sundayMorningWorkouts,
    workout_session_max_minutes: workoutSessionMaxMinutes,
    quick_workouts_under_20: quickWorkoutsUnder20,
    weekend_dual_days: weekendDualDays,
    double_session_days: doubleSessionDays,
    triple_session_days: tripleSessionDays,
    no_days_off_weeks: noDaysOffWeeks,
    weeks_with_workout: weeksWithWorkout,
    months_with_workout: monthsWithWorkout,
    session_volume_kg: sessionVolumeKg,
    week_volume_kg: weekVolumeKg,
    month_volume_kg: monthVolumeKg,
    lifetime_volume_kg: lifetimeVolumeKg,
    session_sets_count: sessionSetsCount,
    hidden_badges_unlocked: hiddenBadgesUnlocked,
    unlocked_badges: unlockedBadges,
    scheduled_sessions_no_miss_60d: scheduledSessionsNoMiss60d,
    comeback_workouts: comebackWorkouts,
    friends_total: friendsTotal,
    workout_shares_total: workoutSharesTotal,
    community_comments_total: communityCommentsTotal,
    likes_received_total: likesReceivedTotal,
    referrals_total: referralsTotal,
    challenges_created_total: challengeTemplatesCreated,
    friend_challenges_sent_total: friendsTotal > 0 ? challengesJoinedTotal : 0,
    challenges_joined_total: challengesJoinedTotal,
    community_active_days: communityActiveDays,
    goals_created_total: goalsCreatedTotal,
    goals_completed_total: goalsCompletedTotal,
    weight_gain_kg: weightGainKg,
    weight_loss_kg: weightLossKg,
    body_fat_drop_percent: bodyFatDropPercent,
    progress_photos_total: progressPhotosTotal,
    plan_adherence_days: trainingStreakDays,
    run_sessions: runSessions.size,
    run_distance_single_km: Number(runDistanceSingleKm.toFixed(2)),
    cycling_sessions: cyclingSessions.size,
    cycling_distance_single_km: Number(cyclingDistanceSingleKm.toFixed(2)),
    rowing_sessions: rowingSessions.size,
    row_distance_single_m: Math.round(rowDistanceSingleM),
    cardio_sessions_total: runSessions.size + cyclingSessions.size + rowingSessions.size,
    burpees_single_session: burpeesSingleSession,
    jump_rope_single_session: jumpRopeSingleSession,
    sled_push_challenges_completed: sledPushChallengesCompleted,
    bench_pr_count: benchPrCount,
    squat_pr_count: squatPrCount,
    deadlift_pr_count: deadliftPrCount,
    triple_big_lift_prs: tripleBigLiftPrs,
    overhead_press_pr_count: overheadPressPrCount,
    weighted_pullup_pr_count: weightedPullupPrCount,
    leg_press_pr_count: legPressPrCount,
    dumbbell_press_pr_count: dumbbellPressPrCount,
    lower_body_prs_single_session: lowerBodyPrsSingleSession,
    upper_body_prs_single_session: upperBodyPrsSingleSession,
    weekend_prs: weekendPrs,
    pr_streak_weeks: prStreakWeeks,
    prs_month: prsMonth,
    prs_lifetime: prsLifetime,
    chest_sets_week: maxWeeklySet('chest'),
    back_sets_week: maxWeeklySet('back'),
    leg_sets_week: maxWeeklySet('legs'),
    shoulder_sets_week: maxWeeklySet('shoulders'),
    arms_sets_week: maxWeeklySet('arms'),
    pushup_reps_lifetime: pushupRepsLifetime,
    pullup_reps_lifetime: pullupRepsLifetime,
    bodyweight_squats_lifetime: bodyweightSquatsLifetime,
    dip_reps_lifetime: dipRepsLifetime,
    core_reps_lifetime: coreRepsLifetime,
    sleep_and_train_days: sleepAndTrainDays,
    smart_rest_decisions: smartRestDecisions,
    recovery_comeback_improved: recoveryComebackImproved,
    workout_share_likes_single_post_20: workoutShareLikesSinglePost20,
    ghost_sessions: soloSessionDays,
    solo_sessions: soloSessionDays,
    solo_session_streak_10: soloSessionStreak10,
    weekly_target_plus_two: weeklyTargetPlusTwo,
    holiday_workouts: holidayWorkouts,
    near_skip_days_trained: nearSkipDaysTrained,
    deload_weeks_completed: deloadWeeksCompleted,
    balanced_athlete_weeks: deloadWeeksCompleted > 0 ? 1 : 0,
    recovery_week_no_overtrained: deloadWeeksCompleted > 0 ? 1 : 0,
    post_deload_performance_boost: deloadWeeksCompleted > 0 && prsLifetime > 0 ? 1 : 0,
    pr_after_low_readiness: lowRecoveryDates.size > 0 && prsLifetime > 0 ? 1 : 0,
    ego_lift_skips_from_recovery: smartRestDecisions,
    on_plan_rest_sessions: smartRestDecisions,
    double_pr_days: doublePrDays,
    triple_pr_days: triplePrDays,
    leg_day_plus_recovery_next_day: recoveryComebackImproved,
    high_volume_no_fail_sessions: sessionSetsCount >= 20 ? 1 : 0,
    bulk_start_condition: weightGainKg >= 1 && (benchPrCount + squatPrCount + deadliftPrCount >= 2) ? 1 : 0,
    recomp_start_condition: weightLossKg >= 1 && prsLifetime >= 1 ? 1 : 0,
    transformation_program_completed: completedProgramFlag,
    wellness_master_weeks: sleepAndTrainDays >= 7 && hydrationLogsComputed >= 7 && proteinTargetDays >= 7 ? 1 : 0,
    heavy_day_avg_weight: sessionVolumeKg >= 5000 ? 1 : 0,
  };

  return {
    ...defaults,
    ...computedMetrics,
    total_points: totalPoints,
    total_xp: xpSummary.totalXp,
    current_level_number: Number(xpSummary.currentLevel?.levelNumber || 0),
  };
};

const buildBadgeRecord = (row) => ({
  id: Number(row.id),
  name: row.name || 'Badge',
  slug: row.slug || '',
  description: row.description || '',
  rarity: row.rarity || 'common',
  isHidden: !!row.is_hidden,
  xpReward: Number(row.xp_reward || 0),
  pointsReward: Number(row.points_reward || 0),
});

export const evaluateAndAwardBadges = async ({ userId } = {}) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) throw new Error('Invalid userId');

  await ensureBadgeInfrastructureOnce();
  const metrics = await collectUserProgressMetrics(normalizedUserId);

  const [ruleRows] = await pool.execute(
    `SELECT
        b.id,
        b.name,
        b.slug,
        b.description,
        b.rarity,
        b.is_hidden,
        b.xp_reward,
        b.points_reward,
        br.condition_type,
        br.operator_symbol,
        br.target_value
     FROM badges b
     JOIN badge_rules br ON br.badge_id = b.id
     WHERE b.active = TRUE
     ORDER BY b.id ASC, br.id ASC`,
  );

  const [existingBadgeRows] = await pool.execute(
    `SELECT badge_id
     FROM user_badges
     WHERE user_id = ?`,
    [normalizedUserId],
  );
  const unlockedBadgeIds = new Set(existingBadgeRows.map((row) => Number(row.badge_id || 0)));

  const grouped = new Map();
  for (const row of ruleRows) {
    const badgeId = Number(row.id);
    const existing = grouped.get(badgeId) || {
      badge: buildBadgeRecord(row),
      rules: [],
    };
    existing.rules.push({
      conditionType: row.condition_type,
      operatorSymbol: row.operator_symbol || '>=',
      targetValue: Number(row.target_value || 0),
    });
    grouped.set(badgeId, existing);
  }

  const unlockedBadges = [];
  const rewards = [];
  let xpFromBadges = 0;

  for (const { badge, rules } of grouped.values()) {
    const evaluations = rules.map((rule) => {
      const metricValue = toFiniteNumber(metrics[rule.conditionType], 0);
      return {
        ...rule,
        metricValue,
        passed: evaluateRule(metricValue, rule.operatorSymbol, rule.targetValue),
        percent: computeRulePercent(metricValue, rule.operatorSymbol, rule.targetValue),
      };
    });

    const currentValue = evaluations.length
      ? Math.max(...evaluations.map((item) => item.metricValue))
      : 0;
    const targetValue = evaluations.length
      ? Math.max(...evaluations.map((item) => item.targetValue))
      : 0;
    const percentComplete = evaluations.length
      ? Math.min(...evaluations.map((item) => item.percent))
      : 0;

    await pool.execute(
      `INSERT INTO user_badge_progress
         (user_id, badge_id, current_value, target_value, percent_complete)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         current_value = VALUES(current_value),
         target_value = VALUES(target_value),
         percent_complete = VALUES(percent_complete),
         updated_at = CURRENT_TIMESTAMP`,
      [normalizedUserId, badge.id, currentValue, targetValue, percentComplete],
    );

    const isUnlockedNow = evaluations.length > 0 && evaluations.every((item) => item.passed);
    if (!isUnlockedNow || unlockedBadgeIds.has(badge.id)) {
      continue;
    }

    const [unlockResult] = await pool.execute(
      `INSERT IGNORE INTO user_badges (user_id, badge_id, progress_value, is_seen)
       VALUES (?, ?, ?, FALSE)`,
      [normalizedUserId, badge.id, currentValue],
    );

    if (Number(unlockResult?.affectedRows || 0) === 0) {
      continue;
    }

    const xpResult = await awardXpOnce({
      userId: normalizedUserId,
      sourceType: 'badge_unlock',
      sourceId: badge.id,
      xpAmount: badge.xpReward,
      description: `Badge unlocked: ${badge.name}`,
    });

    xpFromBadges += Number(xpResult.xpGained || 0);
    if (Array.isArray(xpResult.rewards) && xpResult.rewards.length) {
      rewards.push(...xpResult.rewards);
    }

    unlockedBadges.push({
      ...badge,
      hidden: badge.isHidden,
      xpAwarded: Number(xpResult.xpGained || 0),
    });
  }

  return {
    userId: normalizedUserId,
    metrics,
    unlockedBadges,
    xpFromBadges,
    rewards,
  };
};
