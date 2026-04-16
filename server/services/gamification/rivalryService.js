/* eslint-env node */

import pool from '../../database.js';
import { GAMIFICATION_CONFIG, getRankFromPoints, getStartOfWeek } from './config.js';

let profileImageColumnCache;
const LEADERBOARD_CACHE_TTL_MS = 30 * 1000;
const LEADERBOARD_CACHE_MAX_ENTRIES = 24;
const leaderboardQueryCache = new Map();

const getLeaderboardCacheKey = ({ period, gymId, profileImageColumn }) =>
  `${period}:${gymId == null ? 'global' : gymId}:${profileImageColumn || 'none'}`;

const readLeaderboardCache = (key) => {
  const cached = leaderboardQueryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    leaderboardQueryCache.delete(key);
    return null;
  }
  return cached.value;
};

const writeLeaderboardCache = (key, value) => {
  const now = Date.now();
  leaderboardQueryCache.set(key, {
    value,
    expiresAt: now + LEADERBOARD_CACHE_TTL_MS,
    updatedAt: now,
  });

  for (const [entryKey, entry] of leaderboardQueryCache.entries()) {
    if (entry.expiresAt <= now) {
      leaderboardQueryCache.delete(entryKey);
    }
  }

  if (leaderboardQueryCache.size <= LEADERBOARD_CACHE_MAX_ENTRIES) return;

  let oldestKey = null;
  let oldestUpdatedAt = Number.POSITIVE_INFINITY;
  for (const [entryKey, entry] of leaderboardQueryCache.entries()) {
    if (entry.updatedAt < oldestUpdatedAt) {
      oldestUpdatedAt = entry.updatedAt;
      oldestKey = entryKey;
    }
  }

  if (oldestKey) {
    leaderboardQueryCache.delete(oldestKey);
  }
};

const getProfileImageColumn = async () => {
  if (profileImageColumnCache !== undefined) return profileImageColumnCache;

  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('profile_picture', 'profile_photo')`,
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
  if (columns.has('profile_picture')) profileImageColumnCache = 'profile_picture';
  else if (columns.has('profile_photo')) profileImageColumnCache = 'profile_photo';
  else profileImageColumnCache = null;

  return profileImageColumnCache;
};

const getScopedUserContext = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, gym_id
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  if (!rows.length) return null;
  return {
    userId: Number(rows[0].id),
    gymId: rows[0].gym_id == null ? null : Number(rows[0].gym_id),
  };
};

const getWeeklyRangeSql = () => `
  DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
`;

const getLeaderboardQuery = ({ period, profileImageColumn, scopeWhere }) => {
  const profileSelect = profileImageColumn ? `u.${profileImageColumn} AS profile_picture` : `NULL AS profile_picture`;

  if (period === 'weekly') {
    return `
      SELECT
        u.id,
        u.name,
        ${profileSelect},
        COALESCE(weekly_missions.points, 0)
          + COALESCE(weekly_challenges.points, 0)
          + COALESCE(weekly_friend_challenges.points, 0)
          + COALESCE(weekly_blogs.points, 0) AS points,
        COALESCE(u.total_points, 0) AS total_points
      FROM users u
      LEFT JOIN (
        SELECT um.user_id, SUM(m.points_reward) AS points
        FROM user_missions um
        JOIN missions m ON m.id = um.mission_id
        WHERE um.status = 'completed'
          AND um.completed_at >= ${getWeeklyRangeSql()}
          AND um.completed_at < DATE_ADD(${getWeeklyRangeSql()}, INTERVAL 7 DAY)
        GROUP BY um.user_id
      ) weekly_missions ON weekly_missions.user_id = u.id
      LEFT JOIN (
        SELECT uc.user_id, SUM(ct.points_reward) AS points
        FROM user_challenges uc
        JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
        WHERE uc.status = 'completed'
          AND uc.completed_at >= ${getWeeklyRangeSql()}
          AND uc.completed_at < DATE_ADD(${getWeeklyRangeSql()}, INTERVAL 7 DAY)
        GROUP BY uc.user_id
      ) weekly_challenges ON weekly_challenges.user_id = u.id
      LEFT JOIN (
        SELECT challenge_points.user_id, SUM(challenge_points.points) AS points
        FROM (
          SELECT fcr.participant_a_id AS user_id, fcr.participant_a_points AS points, fcr.completed_at
          FROM friend_challenge_results fcr
          UNION ALL
          SELECT fcr.participant_b_id AS user_id, fcr.participant_b_points AS points, fcr.completed_at
          FROM friend_challenge_results fcr
        ) challenge_points
        WHERE challenge_points.completed_at >= ${getWeeklyRangeSql()}
          AND challenge_points.completed_at < DATE_ADD(${getWeeklyRangeSql()}, INTERVAL 7 DAY)
        GROUP BY challenge_points.user_id
      ) weekly_friend_challenges ON weekly_friend_challenges.user_id = u.id
      LEFT JOIN (
        SELECT bp.user_id, COUNT(*) * ${GAMIFICATION_CONFIG.points.blogPostUpload} AS points
        FROM blog_posts bp
        WHERE bp.created_at >= ${getWeeklyRangeSql()}
          AND bp.created_at < DATE_ADD(${getWeeklyRangeSql()}, INTERVAL 7 DAY)
        GROUP BY bp.user_id
      ) weekly_blogs ON weekly_blogs.user_id = u.id
      WHERE ${scopeWhere}
      ORDER BY points DESC, u.id ASC
    `;
  }

  if (period === 'monthly') {
    return `
      SELECT
        u.id,
        u.name,
        ${profileSelect},
        COALESCE(monthly_missions.points, 0)
          + COALESCE(monthly_challenges.points, 0)
          + COALESCE(monthly_friend_challenges.points, 0)
          + COALESCE(monthly_blogs.points, 0) AS points,
        COALESCE(u.total_points, 0) AS total_points
      FROM users u
      LEFT JOIN (
        SELECT um.user_id, SUM(m.points_reward) AS points
        FROM user_missions um
        JOIN missions m ON m.id = um.mission_id
        WHERE um.status = 'completed'
          AND um.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND um.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
        GROUP BY um.user_id
      ) monthly_missions ON monthly_missions.user_id = u.id
      LEFT JOIN (
        SELECT uc.user_id, SUM(ct.points_reward) AS points
        FROM user_challenges uc
        JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
        WHERE uc.status = 'completed'
          AND uc.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND uc.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
        GROUP BY uc.user_id
      ) monthly_challenges ON monthly_challenges.user_id = u.id
      LEFT JOIN (
        SELECT challenge_points.user_id, SUM(challenge_points.points) AS points
        FROM (
          SELECT fcr.participant_a_id AS user_id, fcr.participant_a_points AS points, fcr.completed_at
          FROM friend_challenge_results fcr
          UNION ALL
          SELECT fcr.participant_b_id AS user_id, fcr.participant_b_points AS points, fcr.completed_at
          FROM friend_challenge_results fcr
        ) challenge_points
        WHERE challenge_points.completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND challenge_points.completed_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
        GROUP BY challenge_points.user_id
      ) monthly_friend_challenges ON monthly_friend_challenges.user_id = u.id
      LEFT JOIN (
        SELECT bp.user_id, COUNT(*) * ${GAMIFICATION_CONFIG.points.blogPostUpload} AS points
        FROM blog_posts bp
        WHERE bp.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND bp.created_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
        GROUP BY bp.user_id
      ) monthly_blogs ON monthly_blogs.user_id = u.id
      WHERE ${scopeWhere}
      ORDER BY points DESC, u.id ASC
    `;
  }

  return `
    SELECT
      u.id,
      u.name,
      ${profileSelect},
      COALESCE(u.total_points, 0) AS points,
      COALESCE(u.total_points, 0) AS total_points
    FROM users u
    WHERE ${scopeWhere}
    ORDER BY points DESC, u.id ASC
  `;
};

export const getLeaderboardBundle = async ({
  userId,
  period = 'weekly',
  limit = GAMIFICATION_CONFIG.rivalry.previewLimit,
} = {}) => {
  const normalizedUserId = Number(userId);
  const normalizedPeriod = ['weekly', 'monthly', 'alltime'].includes(String(period || '').toLowerCase())
    ? String(period).toLowerCase()
    : 'weekly';

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return {
      period: normalizedPeriod,
      leaderboard: [],
      preview: [],
      rivalry: null,
      currentUser: null,
    };
  }

  const [context, profileImageColumn] = await Promise.all([
    getScopedUserContext(normalizedUserId),
    getProfileImageColumn(),
  ]);

  if (!context) {
    return {
      period: normalizedPeriod,
      leaderboard: [],
      preview: [],
      rivalry: null,
      currentUser: null,
    };
  }

  const scopeWhere = context.gymId
    ? `u.role = 'user' AND u.is_active = 1 AND u.gym_id = ?`
    : `u.role = 'user' AND u.is_active = 1`;
  const scopeParams = context.gymId ? [context.gymId] : [];
  const cacheKey = getLeaderboardCacheKey({
    period: normalizedPeriod,
    gymId: context.gymId,
    profileImageColumn,
  });
  let leaderboard = readLeaderboardCache(cacheKey);

  if (!leaderboard) {
    const query = getLeaderboardQuery({
      period: normalizedPeriod,
      profileImageColumn,
      scopeWhere,
    });

    const [rows] = await pool.execute(query, scopeParams);
    leaderboard = rows.map((row, index) => ({
      id: Number(row.id || 0),
      name: row.name || 'User',
      profile_picture: row.profile_picture || null,
      points: Number(row.points || 0),
      total_points: Number(row.total_points || 0),
      rank: index + 1,
      rankName: getRankFromPoints(Number(row.total_points || row.points || 0)),
    }));
    writeLeaderboardCache(cacheKey, leaderboard);
  }

  const currentIndex = leaderboard.findIndex((entry) => entry.id === normalizedUserId);
  const currentUser = currentIndex >= 0 ? leaderboard[currentIndex] : null;
  const nextPlayer = currentIndex > 0 ? leaderboard[currentIndex - 1] : null;
  const playerBehind = currentIndex >= 0 && currentIndex < leaderboard.length - 1 ? leaderboard[currentIndex + 1] : null;

  const rivalry = currentUser
    ? {
        currentRankPosition: currentUser.rank,
        nextPlayerName: nextPlayer?.name || null,
        nextPlayerRank: nextPlayer?.rank || null,
        deltaToNextPlayer: nextPlayer ? Math.max(0, Number(nextPlayer.points || 0) - Number(currentUser.points || 0) + 1) : null,
        playerBehindName: playerBehind?.name || null,
        deltaAheadOfBehind: playerBehind ? Math.max(0, Number(currentUser.points || 0) - Number(playerBehind.points || 0)) : null,
        isCloseToNextPlayer: nextPlayer
          ? Math.max(0, Number(nextPlayer.points || 0) - Number(currentUser.points || 0) + 1) <= GAMIFICATION_CONFIG.rivalry.closeDeltaPoints
          : false,
        urgentPressureFromBehind: playerBehind
          ? Math.max(0, Number(currentUser.points || 0) - Number(playerBehind.points || 0)) <= GAMIFICATION_CONFIG.rivalry.urgentDeltaPoints
          : false,
        insight: nextPlayer
          ? `🔥 ${Math.max(0, Number(nextPlayer.points || 0) - Number(currentUser.points || 0) + 1)} pts to pass ${nextPlayer.name}`
          : null,
      }
    : null;

  const previewLimit = Math.max(3, Math.min(12, Number(limit || GAMIFICATION_CONFIG.rivalry.previewLimit)));
  let preview = leaderboard.slice(0, previewLimit);
  if (currentUser && !preview.some((entry) => entry.id === currentUser.id)) {
    preview = [...preview.slice(0, Math.max(0, previewLimit - 1)), currentUser];
  }

  return {
    period: normalizedPeriod,
    leaderboard,
    preview,
    currentUser,
    rivalry,
    weekStart: normalizedPeriod === 'weekly' ? getStartOfWeek(new Date()).toISOString() : null,
  };
};
