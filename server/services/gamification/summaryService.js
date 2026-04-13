/* eslint-env node */

import pool from '../../database.js';
import { getUserXpSummary } from '../xpService.js';
import {
  GAMIFICATION_CONFIG,
  buildWeeklyTargetState,
  formatDateISO,
  getEndOfWeek,
  getLevelProgress,
  getNextRankInfo,
  getPreviousWeekRange,
  getRankProgress,
  getStartOfWeek,
} from './config.js';
import { getStreakRiskState, getStreakSnapshot } from './streakService.js';
import { getLeaderboardBundle } from './rivalryService.js';
import { buildWeeklyNarrative } from './weeklyNarrativeService.js';
import { buildNextAction } from './nextActionService.js';
import { buildMissionChains, enrichMissionCollection } from './missionEngine.js';
import { fetchAvailableRewards } from './rewardEngine.js';

const safeScalar = async (sql, params = [], field = 'value') => {
  try {
    const [rows] = await pool.execute(sql, params);
    return Number(rows[0]?.[field] || 0);
  } catch {
    return 0;
  }
};

const buildNotificationTriggers = ({
  streakRisk = null,
  highestMission = null,
  rank = null,
  rivalry = null,
  weeklyNarrative = [],
} = {}) => {
  const triggers = [];

  if (streakRisk?.active) {
    triggers.push({
      type: 'streak_risk',
      active: true,
      priority: 100,
      title: streakRisk.title,
      body: streakRisk.description,
      cta: streakRisk.recommendedAction === 'workout' ? 'Start workout' : 'Check recovery',
    });
  }

  if (highestMission && Number(highestMission.percentComplete || 0) >= GAMIFICATION_CONFIG.nearCompletion.missionPercent) {
    triggers.push({
      type: 'mission_near_complete',
      active: true,
      priority: Math.round(Number(highestMission.percentComplete || 0)),
      title: 'Mission nearly complete',
      body: `${highestMission.title} is ${Math.round(Number(highestMission.percentComplete || 0))}% done.`,
      cta: 'Complete mission',
    });
  }

  if (rank?.isCloseToNext && rank?.next) {
    triggers.push({
      type: 'rank_almost_reached',
      active: true,
      priority: 88,
      title: `Close to ${rank.next}`,
      body: `${Math.max(0, Number(rank.pointsToNext || 0))} pts to rank up.`,
      cta: 'Earn points',
    });
  }

  if (rivalry?.nextPlayerName && Number(rivalry.deltaToNextPlayer || 0) <= GAMIFICATION_CONFIG.rivalry.closeDeltaPoints) {
    triggers.push({
      type: 'rivalry_pressure',
      active: true,
      priority: 87,
      title: `Catch ${rivalry.nextPlayerName}`,
      body: `${Math.max(0, Number(rivalry.deltaToNextPlayer || 0))} pts to climb one place.`,
      cta: 'View leaderboard',
    });
  }

  if (weeklyNarrative.length) {
    triggers.push({
      type: 'weekly_summary',
      active: true,
      priority: 50,
      title: weeklyNarrative[0]?.title || 'Weekly summary ready',
      body: weeklyNarrative[0]?.detail || 'Open your progress dashboard for the latest insights.',
      cta: 'View progress',
    });
  }

  return triggers.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
};

const getWeeklyXpTotals = async (userId, baseDate = new Date()) => {
  const currentWeekStart = formatDateISO(getStartOfWeek(baseDate));
  const currentWeekEnd = formatDateISO(getEndOfWeek(baseDate));
  const previousWeek = getPreviousWeekRange(baseDate);
  const previousWeekStart = formatDateISO(previousWeek.start);
  const previousWeekEnd = formatDateISO(previousWeek.end);

  const [currentXp, previousXp] = await Promise.all([
    safeScalar(
      `SELECT COALESCE(SUM(xp_amount), 0) AS value
       FROM xp_transactions
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, currentWeekStart, currentWeekEnd],
    ),
    safeScalar(
      `SELECT COALESCE(SUM(xp_amount), 0) AS value
       FROM xp_transactions
       WHERE user_id = ?
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, previousWeekStart, previousWeekEnd],
    ),
  ]);

  return {
    current: Math.max(0, Number(currentXp || 0)),
    previous: Math.max(0, Number(previousXp || 0)),
  };
};

const getRecoveryComparison = async (userId, baseDate = new Date()) => {
  const currentWeekStart = formatDateISO(getStartOfWeek(baseDate));
  const currentWeekEnd = formatDateISO(getEndOfWeek(baseDate));
  const previousWeek = getPreviousWeekRange(baseDate);
  const previousWeekStart = formatDateISO(previousWeek.start);
  const previousWeekEnd = formatDateISO(previousWeek.end);

  const [currentLogs, previousLogs, latestRecoveryScore] = await Promise.all([
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS value
       FROM recovery_history
       WHERE user_id = ?
         AND DATE(recorded_at) BETWEEN ? AND ?`,
      [userId, currentWeekStart, currentWeekEnd],
    ),
    safeScalar(
      `SELECT COUNT(DISTINCT DATE(recorded_at)) AS value
       FROM recovery_history
       WHERE user_id = ?
         AND DATE(recorded_at) BETWEEN ? AND ?`,
      [userId, previousWeekStart, previousWeekEnd],
    ),
    safeScalar(
      `SELECT COALESCE(overall_recovery_score, 0) AS value
       FROM recovery_history
       WHERE user_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [userId],
    ),
  ]);

  const previous = Math.max(0, Number(previousLogs || 0));
  const current = Math.max(0, Number(currentLogs || 0));
  const deltaPercent = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

  return {
    currentLogs: current,
    previousLogs: previous,
    deltaPercent,
    latestScore: Math.max(0, Number(latestRecoveryScore || 0)),
  };
};

const getStrengthComparison = async (userId, baseDate = new Date()) => {
  const currentWeekStart = formatDateISO(getStartOfWeek(baseDate));
  const currentWeekEnd = formatDateISO(getEndOfWeek(baseDate));
  const previousWeek = getPreviousWeekRange(baseDate);
  const previousWeekStart = formatDateISO(previousWeek.start);
  const previousWeekEnd = formatDateISO(previousWeek.end);

  const buildBestE1rmQuery = (start, end) => safeScalar(
    `SELECT COALESCE(MAX(best_e1rm), 0) AS value
     FROM (
       SELECT MAX(weight * (1 + (reps / 30.0))) AS best_e1rm
       FROM workout_sets
       WHERE user_id = ?
         AND completed = 1
         AND weight > 0
         AND reps BETWEEN 1 AND 12
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY LOWER(TRIM(exercise_name))
     ) aggregated`,
    [userId, start, end],
  );

  const [currentBest, previousBest] = await Promise.all([
    buildBestE1rmQuery(currentWeekStart, currentWeekEnd),
    buildBestE1rmQuery(previousWeekStart, previousWeekEnd),
  ]);

  const previous = Math.max(0, Number(previousBest || 0));
  const current = Math.max(0, Number(currentBest || 0));
  const deltaPercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  return {
    currentBest: current,
    previousBest: previous,
    deltaPercent,
  };
};

export const buildGamificationSummary = async ({
  userId,
  refreshedGamification,
  progressionSnapshot = null,
  leaderboardPeriod = 'weekly',
  leaderboardLimit = GAMIFICATION_CONFIG.rivalry.previewLimit,
  baseDate = new Date(),
} = {}) => {
  const normalizedUserId = Number(userId);
  const refreshed = refreshedGamification && typeof refreshedGamification === 'object'
    ? refreshedGamification
    : null;

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !refreshed) {
    return {
      progress: {
        totalXp: 0,
        totalPoints: 0,
        level: null,
        rank: null,
        streaks: null,
        weekly: null,
        nextAction: null,
        rivalry: null,
        summaryInsights: [],
        notificationTriggers: [],
      },
      activeMissionList: [],
      rewardsAvailable: [],
      leaderboardPreview: [],
      nextAction: null,
      weeklyNarrative: [],
      notificationTriggers: [],
    };
  }

  const xpSummary = progressionSnapshot
    ? {
        totalXp: Number(progressionSnapshot.totalXp || 0),
        currentLevel: progressionSnapshot.currentLevel || null,
        nextLevel: progressionSnapshot.nextLevel || null,
      }
    : await getUserXpSummary(normalizedUserId);

  const [leaderboardBundle, streakSnapshot, weeklyXpTotals, recoveryComparison, strengthComparison, availableRewards] = await Promise.all([
    getLeaderboardBundle({ userId: normalizedUserId, period: leaderboardPeriod, limit: leaderboardLimit }),
    getStreakSnapshot({ userId: normalizedUserId, metrics: refreshed.metrics, now: baseDate }),
    getWeeklyXpTotals(normalizedUserId, baseDate),
    getRecoveryComparison(normalizedUserId, baseDate),
    getStrengthComparison(normalizedUserId, baseDate),
    fetchAvailableRewards(normalizedUserId),
  ]);

  const enrichedMissions = await enrichMissionCollection(refreshed.missions || []);
  const activeMissions = enrichedMissions.filter((mission) => mission?.status === 'active');
  const highestMission = activeMissions
    .slice()
    .sort((a, b) => Number(b.percentComplete || 0) - Number(a.percentComplete || 0))[0] || null;
  const missionChains = buildMissionChains(enrichedMissions);

  const rank = getRankProgress(refreshed.totalPoints);
  const level = getLevelProgress(xpSummary);
  const weeklyTarget = activeMissions
    .filter((mission) => String(mission?.mission_type || '').toLowerCase() === 'weekly' && mission?.metric_key === 'workout_days_this_week')
    .sort((a, b) => Number(b.target || 0) - Number(a.target || 0))[0];

  const weekly = {
    periodLabel: 'Week',
    points: Number(leaderboardBundle?.currentUser?.points || 0),
    workoutsCompleted: Math.max(0, Number(refreshed.metrics?.workout_days_this_week || 0)),
    recoveryLogs: Math.max(0, Number(refreshed.metrics?.recovery_logs_this_week || 0)),
    ...buildWeeklyTargetState({
      completed: Number(refreshed.metrics?.workout_days_this_week || 0),
      target: Number(weeklyTarget?.target || GAMIFICATION_CONFIG.weeklyTargets.fallbackWorkouts),
      date: baseDate,
    }),
  };

  const recovery = {
    latestScore: recoveryComparison.latestScore,
    loggedToday: Number(refreshed.metrics?.recovery_logs_today || 0) > 0,
    thisWeek: recoveryComparison.currentLogs,
  };

  const streakRisk = getStreakRiskState({
    metrics: refreshed.metrics,
    streakSnapshot,
    now: baseDate,
  });

  const weeklyNarrative = buildWeeklyNarrative({
    weekly,
    rivalry: leaderboardBundle.rivalry,
    rank,
    streakRisk,
    weeklyXp: weeklyXpTotals.current,
    previousWeeklyXp: weeklyXpTotals.previous,
    recoveryDeltaPercent: recoveryComparison.deltaPercent,
    strongestLiftDelta: strengthComparison.deltaPercent,
  });

  const nextAction = buildNextAction({
    streakRisk,
    activeMissionList: activeMissions,
    weekly,
    rank,
    rivalry: leaderboardBundle.rivalry,
    recovery,
  });

  const notificationTriggers = buildNotificationTriggers({
    streakRisk,
    highestMission,
    rank,
    rivalry: leaderboardBundle.rivalry,
    weeklyNarrative,
  });

  return {
    progress: {
      totalXp: level.totalXp,
      totalPoints: Number(refreshed.totalPoints || 0),
      level,
      rank,
      streaks: {
        dailyActivity: streakSnapshot.dailyActivity,
        workout: streakSnapshot.workout,
        recovery: streakSnapshot.recovery,
        weeklyConsistency: streakSnapshot.weeklyConsistency,
        freezeTokens: streakSnapshot.freezeTokens,
        protectedToday: streakSnapshot.protectedToday,
        lastActivityDate: streakSnapshot.lastActivityDate,
        risk: streakRisk,
      },
      weekly,
      nextAction,
      rivalry: leaderboardBundle.rivalry,
      summaryInsights: weeklyNarrative,
      notificationTriggers,
    },
    activeMissions,
    missionChains,
    rewardsAvailable: availableRewards,
    leaderboardPreview: leaderboardBundle.preview,
    nextAction,
    weeklyNarrative,
    notificationTriggers,
    leaderboard: {
      period: leaderboardBundle.period,
      currentUser: leaderboardBundle.currentUser,
      rivalry: leaderboardBundle.rivalry,
      preview: leaderboardBundle.preview,
    },
    recovery,
    rank,
    nextRank: getNextRankInfo(refreshed.totalPoints),
  };
};
