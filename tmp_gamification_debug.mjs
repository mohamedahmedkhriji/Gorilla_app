import pool from './server/database.js';
import { evaluateAndAwardBadges } from './server/services/badgeService.js';
import { evaluateAndAwardAchievements } from './server/services/achievementService.js';
import { processGamificationProgression } from './server/services/progressionService.js';

const mode = String(process.argv[2] || 'badges').trim().toLowerCase();
const userId = Number(process.argv[3] || 106);

const originalExecute = pool.execute.bind(pool);
pool.execute = async (sql, params) => {
  try {
    return await originalExecute(sql, params);
  } catch (error) {
    const compactSql = String(sql || '').replace(/\s+/g, ' ').trim();
    console.error(JSON.stringify({
      queryPreview: compactSql.slice(0, 240),
      paramCount: Array.isArray(params) ? params.length : 0,
      params: Array.isArray(params) ? params : [],
      message: error?.message || String(error),
    }, null, 2));
    throw error;
  }
};

console.log(JSON.stringify({ mode, userId, phase: 'start' }));

try {
  if (mode === 'progression') {
    const [[userRows], [missionRows], [challengeRows]] = await Promise.all([
      pool.execute(
        `SELECT COALESCE(total_points, 0) AS total_points
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId],
      ),
      pool.execute(
        `SELECT
            um.id,
            um.status,
            um.completed_at,
            um.current_progress,
            um.target_value,
            m.title,
            m.points_reward,
            m.xp_reward,
            m.mission_type,
            m.metric_key
         FROM user_missions um
         JOIN missions m ON m.id = um.mission_id
         WHERE um.user_id = ?`,
        [userId],
      ),
      pool.execute(
        `SELECT
            uc.id,
            uc.status,
            uc.completed_at,
            uc.current_progress,
            uc.target_value,
            ct.title,
            ct.points_reward,
            ct.challenge_type,
            ct.metric_key
         FROM user_challenges uc
         JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
         WHERE uc.user_id = ?`,
        [userId],
      ),
    ]);

    const result = await processGamificationProgression({
      userId,
      gamification: {
        userId,
        totalPoints: Number(userRows[0]?.total_points || 0),
        metrics: {},
        missions: missionRows.map((row) => ({
          id: Number(row.id || 0),
          title: row.title || '',
          points_reward: Number(row.points_reward || 0),
          xp_reward: Number(row.xp_reward || 0),
          progress: Number(row.current_progress || 0),
          target: Number(row.target_value || 0),
          completed: String(row.status || '') === 'completed',
          completed_at: row.completed_at || null,
          status: row.status || 'active',
          mission_type: row.mission_type || null,
          metric_key: row.metric_key || null,
        })),
        challenges: challengeRows.map((row) => ({
          id: Number(row.id || 0),
          title: row.title || '',
          points_reward: Number(row.points_reward || 0),
          progress: Number(row.current_progress || 0),
          target: Number(row.target_value || 0),
          completed: String(row.status || '') === 'completed',
          completed_at: row.completed_at || null,
          status: row.status || 'active',
          challenge_type: row.challenge_type || null,
          metric_key: row.metric_key || null,
        })),
      },
    });
    console.log(JSON.stringify({
      mode,
      userId,
      awarded: !!result.awarded,
      xp: result.xpGained,
      rewards: Array.isArray(result.rewards) ? result.rewards.length : 0,
    }));
  } else if (mode === 'achievements') {
    const result = await evaluateAndAwardAchievements({ userId });
    console.log(JSON.stringify({
      mode,
      userId,
      unlocked: result.unlockedAchievements.length,
      xp: result.xpFromAchievements,
    }));
  } else {
    const result = await evaluateAndAwardBadges({ userId });
    console.log(JSON.stringify({
      mode,
      userId,
      unlocked: result.unlockedBadges.length,
      xp: result.xpFromBadges,
    }));
  }
} catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}
