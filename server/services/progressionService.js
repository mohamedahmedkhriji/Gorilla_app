/* eslint-env node */
import { evaluateAndAwardBadges } from './badgeService.js';
import { evaluateAndAwardAchievements } from './achievementService.js';
import { awardXpOnce, getUserXpSummary } from './xpService.js';
import { getGamificationEventTypeForSource, validateGamificationEventInput } from './gamification/eventTypes.js';
import { getRankFromPoints } from './gamification/config.js';
import { normalizeRewardEntries } from './gamification/rewardEngine.js';
import { buildGamificationSummary } from './gamification/summaryService.js';

const levelPayload = (level) => {
  if (!level) return null;
  return {
    id: Number(level.id),
    levelNumber: Number(level.levelNumber || 0),
    name: level.name || '',
    xpRequired: Number(level.xpRequired || 0),
    tier: Number(level.tier || 0),
  };
};

export const processProgressionEvent = async ({
  userId,
  sourceType,
  sourceId = null,
  xpAmount = null,
  description = null,
} = {}) => {
  const validation = validateGamificationEventInput({
    userId,
    eventSourceType: sourceType,
    eventSourceId: sourceId,
  });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid progression event');
  }

  const before = await getUserXpSummary(validation.normalizedUserId);
  const xpResult = await awardXpOnce({
    userId: validation.normalizedUserId,
    sourceType: validation.normalizedEventSourceType,
    sourceId: validation.normalizedEventSourceId,
    xpAmount,
    description,
  });
  const badgeResult = await evaluateAndAwardBadges({ userId: validation.normalizedUserId });
  const after = await getUserXpSummary(validation.normalizedUserId);

  const rewards = normalizeRewardEntries([
    ...(Array.isArray(xpResult.rewards) ? xpResult.rewards : []),
    ...(Array.isArray(badgeResult.rewards) ? badgeResult.rewards : []),
  ]);

  return {
    awarded: !!xpResult.awarded || badgeResult.unlockedBadges.length > 0,
    eventType: getGamificationEventTypeForSource(validation.normalizedEventSourceType),
    xpGained: Number(xpResult.xpGained || 0) + Number(badgeResult.xpFromBadges || 0),
    eventXpGained: Number(xpResult.xpGained || 0),
    badgeXpGained: Number(badgeResult.xpFromBadges || 0),
    totalXp: Number(after.totalXp || 0),
    previousLevel: levelPayload(before.currentLevel),
    currentLevel: levelPayload(after.currentLevel),
    nextLevel: levelPayload(after.nextLevel),
    leveledUp: Number(before.currentLevel?.id || 0) !== Number(after.currentLevel?.id || 0),
    unlockedBadges: badgeResult.unlockedBadges,
    unlockedRewards: rewards,
    rewards,
  };
};

const normalizeEventEntries = (entries, sourceType) =>
  (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.completed && entry?.completed_at && Number(entry?.id || 0) > 0)
    .map((entry) => ({
      id: Number(entry.id),
      sourceType,
      xpAmount: Number(entry.xp_reward || 0) > 0 ? Number(entry.xp_reward || 0) : null,
      pointsReward: Number(entry.points_reward || 0),
      title: entry.title || '',
      description: entry.title ? `${sourceType === 'mission_complete' ? 'Mission' : 'Challenge'} completed: ${entry.title}` : null,
    }));

export const processGamificationProgression = async ({
  userId,
  gamification = null,
  eventSourceType = null,
  eventSourceId = null,
  eventXpAmount = null,
  eventDescription = null,
} = {}) => {
  const validation = validateGamificationEventInput({
    userId,
    eventSourceType,
    eventSourceId,
  });

  if (!validation.valid && eventSourceType) {
    throw new Error(validation.error || 'Invalid gamification progression input');
  }

  const normalizedUserId = validation.normalizedUserId;
  const normalizedEventSourceType = validation.normalizedEventSourceType;
  const normalizedEventSourceId = validation.normalizedEventSourceId;
  const before = await getUserXpSummary(normalizedUserId);

  let eventXpGained = 0;
  let missionXpGained = 0;
  let challengeXpGained = 0;
  let pointsGained = 0;
  let eventAwarded = false;
  let eventStreakBonusPercent = 0;
  const completedMissions = [];
  const completedChallenges = [];
  const rewards = [];

  if (normalizedEventSourceType) {
    const xpResult = await awardXpOnce({
      userId: normalizedUserId,
      sourceType: normalizedEventSourceType,
      sourceId: normalizedEventSourceId,
      xpAmount: eventXpAmount,
      description: eventDescription,
    });
    eventXpGained += Number(xpResult.xpGained || 0);
    eventAwarded = !!xpResult.awarded;
    eventStreakBonusPercent = Number(xpResult.streakBonusPercent || 0);
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const missionEntries = normalizeEventEntries(gamification?.missions, 'mission_complete');
  for (const entry of missionEntries) {
    const xpResult = await awardXpOnce({
      userId: normalizedUserId,
      sourceType: entry.sourceType,
      sourceId: entry.id,
      xpAmount: entry.xpAmount,
      description: entry.description,
    });
    const awardedNow = !!xpResult.awarded;
    missionXpGained += Number(xpResult.xpGained || 0);
    if (awardedNow) {
      pointsGained += Number(entry.pointsReward || 0);
      completedMissions.push({
        id: entry.id,
        title: entry.title || '',
        pointsReward: Number(entry.pointsReward || 0),
        xpAwarded: Number(xpResult.xpGained || 0),
      });
    }
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const challengeEntries = normalizeEventEntries(gamification?.challenges, 'challenge_complete');
  for (const entry of challengeEntries) {
    const xpResult = await awardXpOnce({
      userId: normalizedUserId,
      sourceType: entry.sourceType,
      sourceId: entry.id,
      xpAmount: entry.xpAmount,
      description: entry.description,
    });
    const awardedNow = !!xpResult.awarded;
    challengeXpGained += Number(xpResult.xpGained || 0);
    if (awardedNow) {
      pointsGained += Number(entry.pointsReward || 0);
      completedChallenges.push({
        id: entry.id,
        title: entry.title || '',
        pointsReward: Number(entry.pointsReward || 0),
        xpAwarded: Number(xpResult.xpGained || 0),
      });
    }
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const badgeResult = await evaluateAndAwardBadges({ userId: normalizedUserId });
  const achievementResult = await evaluateAndAwardAchievements({ userId: normalizedUserId });
  const after = await getUserXpSummary(normalizedUserId);

  rewards.push(
    ...(Array.isArray(badgeResult.rewards) ? badgeResult.rewards : []),
    ...(Array.isArray(achievementResult.rewards) ? achievementResult.rewards : []),
  );

  const currentPoints = Math.max(0, Number(gamification?.totalPoints || 0));
  const previousPoints = Math.max(0, currentPoints - pointsGained);
  const previousRank = getRankFromPoints(previousPoints);
  const currentRank = getRankFromPoints(currentPoints);
  const summary = gamification
    ? await buildGamificationSummary({
        userId: normalizedUserId,
        refreshedGamification: gamification,
        progressionSnapshot: {
          totalXp: Number(after.totalXp || 0),
          currentLevel: after.currentLevel || null,
          nextLevel: after.nextLevel || null,
        },
      })
    : null;

  return {
    awarded: eventAwarded
      || eventXpGained > 0
      || missionXpGained > 0
      || challengeXpGained > 0
      || badgeResult.unlockedBadges.length > 0
      || achievementResult.unlockedAchievements.length > 0,
    eventType: getGamificationEventTypeForSource(normalizedEventSourceType),
    xpGained: eventXpGained
      + missionXpGained
      + challengeXpGained
      + Number(badgeResult.xpFromBadges || 0)
      + Number(achievementResult.xpFromAchievements || 0),
    pointsGained,
    eventXpGained,
    missionXpGained,
    challengeXpGained,
    badgeXpGained: Number(badgeResult.xpFromBadges || 0),
    achievementXpGained: Number(achievementResult.xpFromAchievements || 0),
    totalXp: Number(after.totalXp || 0),
    previousLevel: levelPayload(before.currentLevel),
    currentLevel: levelPayload(after.currentLevel),
    nextLevel: levelPayload(after.nextLevel),
    leveledUp: Number(before.currentLevel?.id || 0) !== Number(after.currentLevel?.id || 0),
    previousRank,
    currentRank,
    rankedUp: previousRank !== currentRank,
    streakBonusPercent: eventStreakBonusPercent,
    completedMissions,
    completedChallenges,
    unlockedBadges: badgeResult.unlockedBadges,
    unlockedAchievements: achievementResult.unlockedAchievements,
    unlockedRewards: normalizeRewardEntries(rewards),
    rewards: normalizeRewardEntries(rewards),
    nextAction: summary?.nextAction || null,
    notificationTriggers: summary?.notificationTriggers || [],
    progress: summary?.progress || null,
    validation: {
      normalizedEventSourceType,
      normalizedEventSourceId,
    },
  };
};
