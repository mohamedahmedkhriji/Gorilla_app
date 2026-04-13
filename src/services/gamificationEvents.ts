import type {
  GamificationDelta,
  GamificationLeaderboardEntry,
  GamificationMission,
  GamificationMissionChain,
  GamificationNextAction,
  GamificationNotificationTrigger,
  GamificationReward,
  GamificationSummaryInsight,
  GamificationSummaryResponse,
} from '../types/gamification';

const normalizeRewards = (rewards: unknown): GamificationReward[] =>
  (Array.isArray(rewards) ? rewards : [])
    .map((reward) => {
      if (!reward || typeof reward !== 'object') return null;
      const entry = reward as Record<string, unknown>;
      return {
        id: Number(entry.id || 0),
        userRewardId: entry.userRewardId == null ? null : Number(entry.userRewardId),
        name: String(entry.name || 'Reward'),
        rewardType: String(entry.rewardType || 'cosmetic'),
        rarity: String(entry.rarity || 'common') as GamificationReward['rarity'],
        description: entry.description == null ? null : String(entry.description),
        identityKey: entry.identityKey == null ? null : String(entry.identityKey),
        visualVariant: entry.visualVariant == null ? null : String(entry.visualVariant),
        source: {
          type: String((entry.source as Record<string, unknown> | undefined)?.type || 'manual'),
          id: (entry.source as Record<string, unknown> | undefined)?.id == null
            ? null
            : Number((entry.source as Record<string, unknown>).id),
        },
        status: entry.status == null ? undefined : String(entry.status),
        grantedAt: entry.grantedAt == null ? null : String(entry.grantedAt),
      };
    })
    .filter(Boolean) as GamificationReward[];

const normalizeNextAction = (value: unknown): GamificationNextAction | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  return {
    type: String(entry.type || 'mission'),
    title: String(entry.title || 'Next step'),
    description: String(entry.description || ''),
    ctaLabel: String(entry.ctaLabel || 'Open'),
    priorityScore: Number(entry.priorityScore || 0),
    reasonCode: String(entry.reasonCode || 'stay_on_plan') as GamificationNextAction['reasonCode'],
    accent: entry.accent == null ? undefined : String(entry.accent),
    context: entry.context && typeof entry.context === 'object' ? (entry.context as Record<string, unknown>) : {},
  };
};

const normalizeInsights = (items: unknown): GamificationSummaryInsight[] =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      return {
        type: entry.type == null ? undefined : String(entry.type),
        tone: entry.tone == null ? undefined : String(entry.tone),
        title: String(entry.title || ''),
        detail: String(entry.detail || entry.body || ''),
        value: entry.value == null ? null : String(entry.value),
        accent: entry.accent == null ? null : String(entry.accent),
      };
    })
    .filter((item): item is GamificationSummaryInsight => !!item && !!item.title);

const normalizeTriggers = (items: unknown): GamificationNotificationTrigger[] =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      return {
        type: String(entry.type || 'summary'),
        active: !!entry.active,
        priority: Number(entry.priority || 0),
        title: String(entry.title || ''),
        body: String(entry.body || ''),
        cta: entry.cta == null ? null : String(entry.cta),
      };
    })
    .filter((item): item is GamificationNotificationTrigger => !!item && !!item.title);

const normalizeMission = (value: unknown): GamificationMission | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const progress = Math.max(0, Number(entry.progress || 0));
  const target = Math.max(0, Number(entry.target || 0));
  const percentComplete = Number(entry.percentComplete || (target > 0 ? (progress / target) * 100 : 0));
  return {
    id: Number(entry.id || 0),
    title: String(entry.title || 'Mission'),
    description: entry.description == null ? null : String(entry.description),
    mission_type: entry.mission_type == null ? null : String(entry.mission_type),
    category: entry.category == null ? null : String(entry.category),
    metric_key: entry.metric_key == null ? null : String(entry.metric_key),
    progress,
    target,
    remaining: Math.max(0, Number(entry.remaining ?? Math.max(0, target - progress))),
    percentComplete: Math.max(0, Math.min(100, percentComplete)),
    nearComplete: !!entry.nearComplete || percentComplete >= 80,
    status: entry.status == null ? null : String(entry.status),
    xp_reward: Number(entry.xp_reward || 0),
    points_reward: Number(entry.points_reward || 0),
    chainId: entry.chainId == null ? null : String(entry.chainId),
    chainStep: entry.chainStep == null ? null : Number(entry.chainStep),
    chainLength: entry.chainLength == null ? null : Number(entry.chainLength),
  };
};

const normalizeMissionChains = (items: unknown): GamificationMissionChain[] =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      return {
        chainId: String(entry.chainId || entry.id || ''),
        title: String(entry.title || 'Mission chain'),
        chainStep: Number(entry.chainStep || 0),
        chainLength: Number(entry.chainLength || 0),
        completedSteps: Number(entry.completedSteps || 0),
        percentComplete: Number(entry.percentComplete || 0),
        bonusReward: normalizeRewards(entry.bonusReward ? [entry.bonusReward] : [])[0] || null,
      };
    })
    .filter((item): item is GamificationMissionChain => !!item && !!item.chainId);

const normalizeLeaderboardEntry = (value: unknown): GamificationLeaderboardEntry | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  return {
    userId: Number(entry.userId ?? entry.id ?? 0),
    name: String(entry.displayName || entry.name || 'User'),
    points: Number(entry.points || 0),
    rank: Number(entry.rankPosition ?? entry.rank ?? 0),
    level: Number(entry.levelNumber ?? entry.level ?? 0),
    profilePicture: entry.profilePicture == null ? null : String(entry.profilePicture),
    rankName: entry.rankName == null ? null : String(entry.rankName),
    deltaToNext: entry.deltaToNext == null ? null : Number(entry.deltaToNext),
    isCurrentUser: !!entry.isCurrentUser,
  };
};

export const normalizeGamificationSummary = (value: unknown): GamificationSummaryResponse | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const progress = entry.progress && typeof entry.progress === 'object'
    ? (entry.progress as Record<string, unknown>)
    : {};

  return {
    userId: entry.userId == null ? undefined : Number(entry.userId),
    progress: {
      totalXp: Number(progress.totalXp || entry.totalXp || 0),
      totalPoints: Number(progress.totalPoints || entry.totalPoints || 0),
      level: progress.level && typeof progress.level === 'object'
        ? {
            current: String((progress.level as Record<string, unknown>).current || (progress.level as Record<string, unknown>).name || ''),
            number: Number((progress.level as Record<string, unknown>).number || 0),
            totalXp: Number((progress.level as Record<string, unknown>).totalXp || progress.totalXp || entry.totalXp || 0),
            currentXp: Number((progress.level as Record<string, unknown>).currentXp || 0),
            currentThreshold: Number((progress.level as Record<string, unknown>).currentThreshold || 0),
            nextThreshold: (progress.level as Record<string, unknown>).nextThreshold == null ? null : Number((progress.level as Record<string, unknown>).nextThreshold),
            xpToNext: Number((progress.level as Record<string, unknown>).xpToNext || 0),
            progressPercent: Number((progress.level as Record<string, unknown>).progressPercent || 0),
          }
        : null,
      rank: progress.rank && typeof progress.rank === 'object'
        ? {
            current: String((progress.rank as Record<string, unknown>).current || entry.rank || 'Bronze'),
            next: (progress.rank as Record<string, unknown>).next == null
              ? (entry.nextRank && typeof entry.nextRank === 'object' ? String((entry.nextRank as Record<string, unknown>).name || '') : null)
              : String((progress.rank as Record<string, unknown>).next),
            currentThreshold: Number((progress.rank as Record<string, unknown>).currentThreshold || 0),
            nextThreshold: (progress.rank as Record<string, unknown>).nextThreshold == null
              ? (entry.nextRank && typeof entry.nextRank === 'object' ? Number((entry.nextRank as Record<string, unknown>).minPoints || 0) : null)
              : Number((progress.rank as Record<string, unknown>).nextThreshold),
            totalPoints: Number((progress.rank as Record<string, unknown>).totalPoints || progress.totalPoints || entry.totalPoints || 0),
            pointsToNext: Number((progress.rank as Record<string, unknown>).pointsToNext || (entry.nextRank && typeof entry.nextRank === 'object' ? (entry.nextRank as Record<string, unknown>).pointsNeeded || 0 : 0)),
            progressPercent: Number((progress.rank as Record<string, unknown>).progressPercent || 0),
            isCloseToNext: !!(progress.rank as Record<string, unknown>).isCloseToNext,
          }
        : null,
      streaks: progress.streaks && typeof progress.streaks === 'object'
        ? {
            dailyActivity: Number((progress.streaks as Record<string, unknown>).dailyActivity || 0),
            workout: Number((progress.streaks as Record<string, unknown>).workout || 0),
            recovery: Number((progress.streaks as Record<string, unknown>).recovery || 0),
            weeklyConsistency: Number((progress.streaks as Record<string, unknown>).weeklyConsistency || 0),
            freezeTokens: Number((progress.streaks as Record<string, unknown>).freezeTokens || 0),
            protectedToday: !!(progress.streaks as Record<string, unknown>).protectedToday,
            lastActivityDate: (progress.streaks as Record<string, unknown>).lastActivityDate == null ? null : String((progress.streaks as Record<string, unknown>).lastActivityDate),
            risk: (progress.streaks as Record<string, unknown>).risk && typeof (progress.streaks as Record<string, unknown>).risk === 'object'
              ? {
                  active: !!((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).active,
                  title: String((((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).title) || ''),
                  description: String((((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).description) || ''),
                  recommendedAction: (((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).recommendedAction) == null ? null : String((((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).recommendedAction)),
                  dailyActivityStreak: Number((((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).dailyActivityStreak) || 0),
                  freezeTokens: Number((((progress.streaks as Record<string, unknown>).risk as Record<string, unknown>).freezeTokens) || 0),
                }
              : null,
          }
        : null,
      weekly: progress.weekly && typeof progress.weekly === 'object'
        ? {
            periodLabel: (progress.weekly as Record<string, unknown>).periodLabel == null ? null : String((progress.weekly as Record<string, unknown>).periodLabel),
            points: Number((progress.weekly as Record<string, unknown>).points || 0),
            workoutsCompleted: Number((progress.weekly as Record<string, unknown>).workoutsCompleted || 0),
            recoveryLogs: Number((progress.weekly as Record<string, unknown>).recoveryLogs || 0),
            target: Number((progress.weekly as Record<string, unknown>).target || 0),
            remaining: Number((progress.weekly as Record<string, unknown>).remaining || 0),
            targetAtRisk: !!(progress.weekly as Record<string, unknown>).targetAtRisk,
            nearComplete: !!(progress.weekly as Record<string, unknown>).nearComplete,
            completionPercent: Number((progress.weekly as Record<string, unknown>).completionPercent || 0),
          }
        : null,
      nextAction: normalizeNextAction(progress.nextAction || entry.nextAction),
      rivalry: progress.rivalry && typeof progress.rivalry === 'object'
        ? {
            currentRankPosition: (progress.rivalry as Record<string, unknown>).currentRankPosition == null ? null : Number((progress.rivalry as Record<string, unknown>).currentRankPosition),
            nextPlayerName: (progress.rivalry as Record<string, unknown>).nextPlayerName == null ? null : String((progress.rivalry as Record<string, unknown>).nextPlayerName),
            nextPlayerRank: (progress.rivalry as Record<string, unknown>).nextPlayerRank == null ? null : Number((progress.rivalry as Record<string, unknown>).nextPlayerRank),
            nextPlayerPoints: (progress.rivalry as Record<string, unknown>).nextPlayerPoints == null ? null : Number((progress.rivalry as Record<string, unknown>).nextPlayerPoints),
            deltaToNextPlayer: (progress.rivalry as Record<string, unknown>).deltaToNextPlayer == null ? null : Number((progress.rivalry as Record<string, unknown>).deltaToNextPlayer),
            behindPlayerName: (progress.rivalry as Record<string, unknown>).behindPlayerName == null ? null : String((progress.rivalry as Record<string, unknown>).behindPlayerName),
            deltaAheadOfBehind: (progress.rivalry as Record<string, unknown>).deltaAheadOfBehind == null ? null : Number((progress.rivalry as Record<string, unknown>).deltaAheadOfBehind),
          }
        : null,
      summaryInsights: normalizeInsights(progress.summaryInsights || entry.weeklyNarrative),
      notificationTriggers: normalizeTriggers(progress.notificationTriggers || entry.notificationTriggers),
    },
    activeMissionList: (Array.isArray(entry.activeMissionList) ? entry.activeMissionList : Array.isArray(entry.activeMissions) ? entry.activeMissions : [])
      .map(normalizeMission)
      .filter((item): item is GamificationMission => !!item),
    missionChains: normalizeMissionChains(entry.missionChains),
    rewardsAvailable: normalizeRewards(entry.rewardsAvailable),
    leaderboardPreview: (Array.isArray(entry.leaderboardPreview) ? entry.leaderboardPreview : Array.isArray((entry.leaderboard as Record<string, unknown> | undefined)?.preview) ? (entry.leaderboard as Record<string, unknown>).preview as unknown[] : [])
      .map(normalizeLeaderboardEntry)
      .filter((item): item is GamificationLeaderboardEntry => !!item),
    nextAction: normalizeNextAction(entry.nextAction || progress.nextAction),
    weeklyNarrative: normalizeInsights(entry.weeklyNarrative || progress.summaryInsights),
    notificationTriggers: normalizeTriggers(entry.notificationTriggers || progress.notificationTriggers),
    leaderboard: entry.leaderboard && typeof entry.leaderboard === 'object'
      ? {
          period: (entry.leaderboard as Record<string, unknown>).period == null ? undefined : String((entry.leaderboard as Record<string, unknown>).period),
          currentUser: normalizeLeaderboardEntry((entry.leaderboard as Record<string, unknown>).currentUser),
          rivalry: progress.rivalry && typeof progress.rivalry === 'object'
            ? {
                currentRankPosition: (progress.rivalry as Record<string, unknown>).currentRankPosition == null ? null : Number((progress.rivalry as Record<string, unknown>).currentRankPosition),
                nextPlayerName: (progress.rivalry as Record<string, unknown>).nextPlayerName == null ? null : String((progress.rivalry as Record<string, unknown>).nextPlayerName),
                nextPlayerRank: (progress.rivalry as Record<string, unknown>).nextPlayerRank == null ? null : Number((progress.rivalry as Record<string, unknown>).nextPlayerRank),
                nextPlayerPoints: (progress.rivalry as Record<string, unknown>).nextPlayerPoints == null ? null : Number((progress.rivalry as Record<string, unknown>).nextPlayerPoints),
                deltaToNextPlayer: (progress.rivalry as Record<string, unknown>).deltaToNextPlayer == null ? null : Number((progress.rivalry as Record<string, unknown>).deltaToNextPlayer),
                behindPlayerName: (progress.rivalry as Record<string, unknown>).behindPlayerName == null ? null : String((progress.rivalry as Record<string, unknown>).behindPlayerName),
                deltaAheadOfBehind: (progress.rivalry as Record<string, unknown>).deltaAheadOfBehind == null ? null : Number((progress.rivalry as Record<string, unknown>).deltaAheadOfBehind),
              }
            : null,
          preview: (Array.isArray((entry.leaderboard as Record<string, unknown>).preview) ? (entry.leaderboard as Record<string, unknown>).preview : [])
            .map(normalizeLeaderboardEntry)
            .filter((item): item is GamificationLeaderboardEntry => !!item),
        }
      : undefined,
  };
};

export const normalizeGamificationDelta = (value: unknown): GamificationDelta | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;

  return {
    eventType: entry.eventType == null ? null : String(entry.eventType),
    awarded: !!entry.awarded,
    xpGained: Number(entry.xpGained || 0),
    pointsGained: Number(entry.pointsGained || 0),
    eventXpGained: Number(entry.eventXpGained || 0),
    missionXpGained: Number(entry.missionXpGained || 0),
    challengeXpGained: Number(entry.challengeXpGained || 0),
    badgeXpGained: Number(entry.badgeXpGained || 0),
    achievementXpGained: Number(entry.achievementXpGained || 0),
    leveledUp: !!entry.leveledUp,
    rankedUp: !!entry.rankedUp,
    previousLevel: (entry.previousLevel as Record<string, unknown> | null) || null,
    currentLevel: (entry.currentLevel as Record<string, unknown> | null) || null,
    nextLevel: (entry.nextLevel as Record<string, unknown> | null) || null,
    previousRank: entry.previousRank == null ? null : String(entry.previousRank),
    currentRank: entry.currentRank == null ? null : String(entry.currentRank),
    streakBonusPercent: Number(entry.streakBonusPercent || 0),
    completedMissions: Array.isArray(entry.completedMissions) ? (entry.completedMissions as Array<Record<string, unknown>>) : [],
    completedChallenges: Array.isArray(entry.completedChallenges) ? (entry.completedChallenges as Array<Record<string, unknown>>) : [],
    unlockedBadges: Array.isArray(entry.unlockedBadges) ? (entry.unlockedBadges as Array<Record<string, unknown>>) : [],
    unlockedAchievements: Array.isArray(entry.unlockedAchievements) ? (entry.unlockedAchievements as Array<Record<string, unknown>>) : [],
    unlockedRewards: normalizeRewards(entry.unlockedRewards || entry.rewards),
    nextAction: normalizeNextAction(entry.nextAction),
    notificationTriggers: normalizeTriggers(entry.notificationTriggers) as Array<Record<string, unknown>>,
    progress: normalizeGamificationSummary({ progress: entry.progress }).progress as Record<string, unknown>,
  };
};
