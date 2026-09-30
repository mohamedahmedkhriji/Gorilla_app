export const createGamificationController = ({
  buildGamificationSummary,
  collectUserGamificationMetrics,
  dbPool,
  enrichMissionCollection,
  gamificationReady,
  getLeaderboardBundle,
  getUserProgressionDetails,
  getUserProgressionSnapshot,
  refreshGamificationForUser,
  runProgressionEventSafely,
  toNumber,
} = {}) => {
  const parseUserId = (value) => toNumber(value);

  const listLeaderboard = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const period = String(req.query.period || 'alltime').toLowerCase();
      if (!['weekly', 'monthly', 'alltime'].includes(period)) {
        return res.status(400).json({ error: "Invalid period. Use 'weekly', 'monthly' or 'alltime'" });
      }

      const bundle = await getLeaderboardBundle({ userId, period });
      return res.json({
        period: bundle.period,
        leaderboard: bundle.leaderboard,
        preview: bundle.preview,
        rivalry: bundle.rivalry,
        currentUser: bundle.currentUser,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const listMissions = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      const missions = await enrichMissionCollection(
        (refreshed?.missions || []).filter((mission) => mission?.status !== 'expired'),
      );
      return res.json(missions);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const listMissionHistory = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      await refreshGamificationForUser(userId);

      const [rows] = await dbPool.execute(
        `SELECT m.title, m.points_reward, um.completed_at,
                DATE_FORMAT(um.completed_at, '%M %Y') AS period
         FROM user_missions um
         JOIN missions m ON m.id = um.mission_id
         WHERE um.user_id = ? AND um.status = 'completed' AND um.completed_at IS NOT NULL
         ORDER BY um.completed_at DESC`,
        [userId]
      );

      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const listChallenges = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      const challenges = refreshed?.challenges || [];
      const visibleChallenges = challenges.filter((challenge) => challenge?.status !== 'expired');

      return res.json({
        daily: visibleChallenges.filter((c) => c.challenge_type === 'daily'),
        weekly: visibleChallenges.filter((c) => c.challenge_type === 'weekly'),
        totals: {
          completed: visibleChallenges.filter((c) => c.completed).length,
          active: visibleChallenges.filter((c) => c.status === 'active').length,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const listChallengeHistory = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      await refreshGamificationForUser(userId);

      const [rows] = await dbPool.execute(
        `SELECT
            ct.title,
            ct.challenge_type,
            ct.points_reward,
            uc.instance_key,
            uc.completed_at,
            DATE_FORMAT(uc.completed_at, '%M %Y') AS period
         FROM user_challenges uc
         JOIN challenge_templates ct ON ct.id = uc.challenge_template_id
         WHERE uc.user_id = ? AND uc.status = 'completed' AND uc.completed_at IS NOT NULL
         ORDER BY uc.completed_at DESC`,
        [userId],
      );

      return res.json(rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getGamificationSummary = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      if (!refreshed) {
        return res.status(404).json({ error: 'User not found' });
      }
      const progression = await runProgressionEventSafely({
        userId,
        gamification: refreshed,
      });
      const progressionSnapshot = await getUserProgressionSnapshot(userId);
      const summary = await buildGamificationSummary({
        userId,
        refreshedGamification: refreshed,
        progressionSnapshot,
        leaderboardPeriod: String(req.query?.leaderboardPeriod || 'weekly').trim().toLowerCase(),
      });

      return res.json({
        ...summary,
        userId: refreshed.userId,
        totalPoints: refreshed.totalPoints,
        missionPoints: refreshed.missionPoints,
        challengePoints: refreshed.challengePoints,
        rank: refreshed.rank,
        nextRank: refreshed.nextRank,
        totalWorkouts: refreshed.totalWorkouts,
        totalXp: progressionSnapshot.totalXp,
        currentLevel: progressionSnapshot.currentLevel,
        nextLevel: progressionSnapshot.nextLevel,
        unlockedBadges: progressionSnapshot.unlockedBadges,
        unlockedAchievements: progressionSnapshot.unlockedAchievements,
        availableRewards: progressionSnapshot.availableRewards,
        completedMissions: refreshed.completedMissions,
        completedChallenges: refreshed.completedChallenges,
        activeMissions: refreshed.missions.filter((m) => m.status === 'active').length,
        activeMissionCount: refreshed.missions.filter((m) => m.status === 'active').length,
        activeChallenges: refreshed.challenges.filter((c) => c.status === 'active').length,
        progression,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getUserRank = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      if (!refreshed) {
        return res.status(404).json({ error: 'User not found' });
      }

      const progressionSnapshot = await getUserProgressionSnapshot(userId);
      const summary = await buildGamificationSummary({
        userId,
        refreshedGamification: refreshed,
        progressionSnapshot,
        leaderboardPeriod: 'weekly',
      });

      return res.json({
        userId,
        rank: summary.progress.rank,
        level: summary.progress.level,
        streaks: summary.progress.streaks,
        rivalry: summary.progress.rivalry,
        nextAction: summary.nextAction,
        notificationTriggers: summary.notificationTriggers,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const updateMissionProgress = async (req, res) => {
    try {
      const userId = parseUserId(req.body?.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      if (!refreshed) {
        return res.status(404).json({ error: 'User not found' });
      }

      const progressionSnapshot = await getUserProgressionSnapshot(userId);
      const summary = await buildGamificationSummary({
        userId,
        refreshedGamification: refreshed,
        progressionSnapshot,
        leaderboardPeriod: 'weekly',
      });

      return res.json({
        success: true,
        activeMissionList: summary.activeMissionList,
        missionChains: summary.missionChains,
        nextAction: summary.nextAction,
        notificationTriggers: summary.notificationTriggers,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getGamificationProgression = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      const refreshed = await refreshGamificationForUser(userId);
      if (!refreshed) {
        return res.status(404).json({ error: 'User not found' });
      }

      const progression = await runProgressionEventSafely({
        userId,
        gamification: refreshed,
      });

      const xpTransactionsLimit = toNumber(req.query?.txLimit, 20);
      const details = await getUserProgressionDetails(userId, {
        xpTransactionsLimit,
      });

      return res.json({
        userId: refreshed.userId,
        points: {
          total: refreshed.totalPoints,
          mission: refreshed.missionPoints,
          challenge: refreshed.challengePoints,
          blog: refreshed.blogPoints,
        },
        rank: {
          current: refreshed.rank,
          next: refreshed.nextRank,
        },
        xp: {
          total: details.snapshot.totalXp,
          currentLevel: details.snapshot.currentLevel,
          nextLevel: details.snapshot.nextLevel,
        },
        missions: {
          completed: refreshed.completedMissions,
          active: refreshed.missions.filter((m) => m.status === 'active').length,
        },
        challenges: {
          completed: refreshed.completedChallenges,
          active: refreshed.challenges.filter((c) => c.status === 'active').length,
        },
        badges: details.badges,
        badgeTotals: details.badgeTotals,
        achievements: details.achievements,
        achievementTotals: details.achievementTotals,
        rewards: details.rewards,
        rewardTotals: details.rewardTotals,
        xpTransactions: details.xpTransactions,
        progression,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  const getGamificationDebugMetrics = async (req, res) => {
    try {
      const userId = parseUserId(req.params.userId);
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'Invalid userId' });
      }
      await gamificationReady;
      const metrics = await collectUserGamificationMetrics(userId, new Date());
      return res.json({ userId, metrics });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  return {
    getGamificationDebugMetrics,
    getGamificationProgression,
    getGamificationSummary,
    getUserRank,
    listChallengeHistory,
    listChallenges,
    listLeaderboard,
    listMissionHistory,
    listMissions,
    updateMissionProgress,
  };
};
