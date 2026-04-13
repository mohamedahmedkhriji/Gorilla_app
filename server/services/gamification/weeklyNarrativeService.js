/* eslint-env node */

import { GAMIFICATION_CONFIG } from './config.js';

const pushInsight = (insights, insight) => {
  if (!insight?.title || !insight?.detail) return;
  insights.push(insight);
};

export const buildWeeklyNarrative = ({
  weekly = {},
  rivalry = null,
  rank = null,
  streakRisk = null,
  weeklyXp = 0,
  previousWeeklyXp = 0,
  recoveryDeltaPercent = 0,
  strongestLiftDelta = 0,
} = {}) => {
  const insights = [];

  pushInsight(insights, {
    id: 'xp_gain',
    type: 'xp',
    tone: weeklyXp >= previousWeeklyXp ? 'positive' : 'neutral',
    title: `+${Math.max(0, Number(weeklyXp || 0))} XP gained`,
    detail: weeklyXp > previousWeeklyXp
      ? 'You are building momentum faster than last week.'
      : 'Keep stacking sessions to push your XP curve higher.',
    value: Math.max(0, Number(weeklyXp || 0)),
    priority: 92,
    triggerCode: 'weekly_xp_gain',
  });

  pushInsight(insights, {
    id: 'workouts_done',
    type: 'consistency',
    tone: Number(weekly.completionPercent || 0) >= GAMIFICATION_CONFIG.nearCompletion.weeklyTargetPercent ? 'positive' : 'neutral',
    title: `${Math.max(0, Number(weekly.workoutsCompleted || 0))} workouts completed`,
    detail: Number(weekly.target || 0) > 0
      ? `${Math.max(0, Number(weekly.remaining || 0))} left to hit your weekly target.`
      : 'Stay active to keep your progress moving.',
    value: Math.max(0, Number(weekly.workoutsCompleted || 0)),
    priority: 90,
    triggerCode: 'weekly_workouts_completed',
  });

  if (Number(strongestLiftDelta || 0) > 0) {
    pushInsight(insights, {
      id: 'strongest_lift',
      type: 'strength',
      tone: 'positive',
      title: `Strongest lift improved by ${Number(strongestLiftDelta).toFixed(1)}%`,
      detail: 'Strength is trending upward. Keep your next heavy day sharp.',
      value: Number(strongestLiftDelta),
      priority: 88,
      triggerCode: 'strongest_lift_improved',
    });
  }

  if (Number(recoveryDeltaPercent || 0) > 0) {
    pushInsight(insights, {
      id: 'recovery_adherence',
      type: 'recovery',
      tone: 'positive',
      title: `Recovery adherence improved by ${Math.round(Number(recoveryDeltaPercent || 0))}%`,
      detail: 'Recovery is supporting performance better than last week.',
      value: Number(recoveryDeltaPercent),
      priority: 84,
      triggerCode: 'recovery_adherence_improved',
    });
  }

  if (rank?.isCloseToNext && rank?.next) {
    pushInsight(insights, {
      id: 'rank_close',
      type: 'rank',
      tone: 'urgent',
      title: `${Math.max(0, Number(rank.pointsToNext || 0))} pts to ${rank.next}`,
      detail: 'You are close to ranking up. One more good push could do it.',
      value: Math.max(0, Number(rank.pointsToNext || 0)),
      priority: 96,
      triggerCode: 'rank_almost_reached',
    });
  }

  if (rivalry?.nextPlayerName && Number(rivalry.deltaToNextPlayer || 0) <= GAMIFICATION_CONFIG.rivalry.closeDeltaPoints) {
    pushInsight(insights, {
      id: 'rivalry_close',
      type: 'leaderboard',
      tone: 'urgent',
      title: `${Math.max(0, Number(rivalry.deltaToNextPlayer || 0))} pts to pass ${rivalry.nextPlayerName}`,
      detail: `You are chasing #${Number(rivalry.nextPlayerRank || 0)} this ${String(weekly.periodLabel || 'week').toLowerCase()}.`,
      value: Math.max(0, Number(rivalry.deltaToNextPlayer || 0)),
      priority: 95,
      triggerCode: 'rivalry_pressure',
    });
  }

  if (streakRisk?.active) {
    pushInsight(insights, {
      id: 'streak_risk',
      type: 'streak',
      tone: 'urgent',
      title: streakRisk.title || 'Your streak is at risk',
      detail: streakRisk.description || 'Act today to protect your streak.',
      value: Math.max(0, Number(streakRisk.dailyActivityStreak || 0)),
      priority: 100,
      triggerCode: 'streak_risk',
    });
  }

  if (weekly.targetAtRisk) {
    pushInsight(insights, {
      id: 'weekly_target_risk',
      type: 'consistency',
      tone: 'urgent',
      title: 'Weekly target at risk',
      detail: `Complete ${Math.max(1, Number(weekly.remaining || 1))} more session${Number(weekly.remaining || 1) === 1 ? '' : 's'} to stay on track.`,
      value: Math.max(0, Number(weekly.remaining || 0)),
      priority: 94,
      triggerCode: 'weekly_target_at_risk',
    });
  }

  return insights
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 6);
};
