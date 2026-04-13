/* eslint-env node */

import { GAMIFICATION_CONFIG } from './config.js';

const buildAction = (payload) => ({
  type: payload.type,
  title: payload.title,
  description: payload.description,
  ctaLabel: payload.ctaLabel,
  priorityScore: Number(payload.priorityScore || 0),
  reasonCode: payload.reasonCode,
  accent: payload.accent || 'accent',
  context: payload.context || {},
});

export const buildNextAction = ({
  streakRisk = null,
  activeMissions = [],
  weekly = {},
  rank = null,
  rivalry = null,
  recovery = null,
} = {}) => {
  const candidates = [];
  const missions = Array.isArray(activeMissions) ? activeMissions : [];
  const highestMission = missions
    .filter((mission) => mission?.status === 'active')
    .sort((a, b) => Number(b.percentComplete || 0) - Number(a.percentComplete || 0))[0];

  if (streakRisk?.active) {
    candidates.push(buildAction({
      type: streakRisk.recommendedAction === 'workout' ? 'workout' : 'recovery',
      title: streakRisk.title || '🔥 Save your streak',
      description: streakRisk.description || 'Do a quick recovery check-in to keep your streak alive.',
      ctaLabel: streakRisk.recommendedAction === 'workout' ? 'Start workout' : 'Check recovery',
      priorityScore: 100 + Math.max(0, Number(streakRisk.dailyActivityStreak || 0)),
      reasonCode: 'save_streak',
      accent: 'accent',
      context: {
        streakDays: Math.max(0, Number(streakRisk.dailyActivityStreak || 0)),
        freezeTokens: Math.max(0, Number(streakRisk.freezeTokens || 0)),
      },
    }));
  }

  if (highestMission && Number(highestMission.percentComplete || 0) >= GAMIFICATION_CONFIG.nearCompletion.missionPercent) {
    candidates.push(buildAction({
      type: 'mission',
      title: Number(highestMission.percentComplete || 0) >= GAMIFICATION_CONFIG.nearCompletion.missionUrgentPercent
        ? '🔥 You are almost done'
        : '🔥 Finish a mission',
      description: `${highestMission.title} (${Math.round(Number(highestMission.percentComplete || 0))}% complete)`,
      ctaLabel: 'Complete mission',
      priorityScore: 90 + Math.round(Number(highestMission.percentComplete || 0) / 10),
      reasonCode: 'complete_daily_mission',
      accent: 'emerald',
      context: {
        missionId: Number(highestMission.id || 0),
        remaining: Math.max(0, Number(highestMission.remaining || 0)),
      },
    }));
  }

  if (rivalry?.nextPlayerName && Number(rivalry.deltaToNextPlayer || 0) <= GAMIFICATION_CONFIG.rivalry.closeDeltaPoints) {
    candidates.push(buildAction({
      type: 'leaderboard',
      title: '🔥 Beat the next player',
      description: `${Math.max(0, Number(rivalry.deltaToNextPlayer || 0))} pts to pass ${rivalry.nextPlayerName}`,
      ctaLabel: 'Earn points',
      priorityScore: 86 + Math.max(0, GAMIFICATION_CONFIG.rivalry.closeDeltaPoints - Number(rivalry.deltaToNextPlayer || 0)),
      reasonCode: 'beat_next_player',
      accent: 'violet',
      context: {
        nextPlayerName: rivalry.nextPlayerName,
        rankPosition: rivalry.currentRankPosition,
        nextPlayerRank: rivalry.nextPlayerRank,
      },
    }));
  }

  if (rank?.isCloseToNext && rank?.next) {
    candidates.push(buildAction({
      type: 'rank',
      title: '🔥 Rank up is close',
      description: `${Math.max(0, Number(rank.pointsToNext || 0))} pts to ${rank.next}`,
      ctaLabel: 'Keep climbing',
      priorityScore: 84 + Math.max(0, GAMIFICATION_CONFIG.nearCompletion.rankPointsThreshold - Number(rank.pointsToNext || 0)),
      reasonCode: 'rank_up_close',
      accent: 'amber',
      context: {
        nextRank: rank.next,
        pointsToNext: Math.max(0, Number(rank.pointsToNext || 0)),
      },
    }));
  }

  if (weekly?.targetAtRisk) {
    candidates.push(buildAction({
      type: 'workout',
      title: '🔥 Stay on plan',
      description: `Complete ${Math.max(1, Number(weekly.remaining || 1))} session${Number(weekly.remaining || 1) === 1 ? '' : 's'} to stay on track this week.`,
      ctaLabel: 'Start session',
      priorityScore: 80 + Math.max(0, Number(weekly.remaining || 0)),
      reasonCode: 'weekly_target_at_risk',
      accent: 'sky',
      context: {
        remaining: Math.max(0, Number(weekly.remaining || 0)),
        target: Math.max(0, Number(weekly.target || 0)),
      },
    }));
  } else if (Number(weekly?.remaining || 0) > 0) {
    candidates.push(buildAction({
      type: 'workout',
      title: '🔥 Next step',
      description: `Complete ${Math.max(1, Number(weekly.remaining || 1))} more session${Number(weekly.remaining || 1) === 1 ? '' : 's'} to hit your weekly target.`,
      ctaLabel: 'Train now',
      priorityScore: 70,
      reasonCode: 'stay_on_plan',
      accent: 'sky',
      context: {
        remaining: Math.max(0, Number(weekly.remaining || 0)),
      },
    }));
  }

  if (Number(recovery?.latestScore || 0) >= 75 && !recovery?.loggedToday) {
    candidates.push(buildAction({
      type: 'recovery',
      title: '🔥 High recovery opportunity',
      description: 'Your recovery looks ready for a strong training day. Log today to sharpen the plan.',
      ctaLabel: 'Check recovery',
      priorityScore: 78,
      reasonCode: 'high_recovery_opportunity',
      accent: 'emerald',
      context: {
        recoveryScore: Math.max(0, Number(recovery?.latestScore || 0)),
      },
    }));
  }

  if (!candidates.length) {
    return buildAction({
      type: 'mission',
      title: '🔥 Next step',
      description: 'Log one meaningful action today to keep your momentum moving.',
      ctaLabel: 'Open missions',
      priorityScore: 10,
      reasonCode: 'stay_on_plan',
      accent: 'accent',
      context: {},
    });
  }

  candidates.sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
  return candidates[0];
};
