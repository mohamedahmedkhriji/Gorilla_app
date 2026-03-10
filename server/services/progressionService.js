/* eslint-env node */
import { evaluateAndAwardBadges } from './badgeService.js';
import { evaluateAndAwardAchievements } from './achievementService.js';
import { awardXpOnce, getUserXpSummary } from './xpService.js';

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
  const before = await getUserXpSummary(userId);
  const xpResult = await awardXpOnce({
    userId,
    sourceType,
    sourceId,
    xpAmount,
    description,
  });
  const badgeResult = await evaluateAndAwardBadges({ userId });
  const after = await getUserXpSummary(userId);

  const rewards = [
    ...(Array.isArray(xpResult.rewards) ? xpResult.rewards : []),
    ...(Array.isArray(badgeResult.rewards) ? badgeResult.rewards : []),
  ];

  return {
    awarded: !!xpResult.awarded || badgeResult.unlockedBadges.length > 0,
    xpGained: Number(xpResult.xpGained || 0) + Number(badgeResult.xpFromBadges || 0),
    eventXpGained: Number(xpResult.xpGained || 0),
    badgeXpGained: Number(badgeResult.xpFromBadges || 0),
    totalXp: Number(after.totalXp || 0),
    previousLevel: levelPayload(before.currentLevel),
    currentLevel: levelPayload(after.currentLevel),
    nextLevel: levelPayload(after.nextLevel),
    leveledUp: Number(before.currentLevel?.id || 0) !== Number(after.currentLevel?.id || 0),
    unlockedBadges: badgeResult.unlockedBadges,
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
  const before = await getUserXpSummary(userId);

  let eventXpGained = 0;
  let missionXpGained = 0;
  let challengeXpGained = 0;
  const rewards = [];

  if (eventSourceType) {
    const xpResult = await awardXpOnce({
      userId,
      sourceType: eventSourceType,
      sourceId: eventSourceId,
      xpAmount: eventXpAmount,
      description: eventDescription,
    });
    eventXpGained += Number(xpResult.xpGained || 0);
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const missionEntries = normalizeEventEntries(gamification?.missions, 'mission_complete');
  for (const entry of missionEntries) {
    const xpResult = await awardXpOnce({
      userId,
      sourceType: entry.sourceType,
      sourceId: entry.id,
      xpAmount: entry.xpAmount,
      description: entry.description,
    });
    missionXpGained += Number(xpResult.xpGained || 0);
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const challengeEntries = normalizeEventEntries(gamification?.challenges, 'challenge_complete');
  for (const entry of challengeEntries) {
    const xpResult = await awardXpOnce({
      userId,
      sourceType: entry.sourceType,
      sourceId: entry.id,
      xpAmount: entry.xpAmount,
      description: entry.description,
    });
    challengeXpGained += Number(xpResult.xpGained || 0);
    if (Array.isArray(xpResult.rewards)) rewards.push(...xpResult.rewards);
  }

  const badgeResult = await evaluateAndAwardBadges({ userId });
  const achievementResult = await evaluateAndAwardAchievements({ userId });
  const after = await getUserXpSummary(userId);

  rewards.push(
    ...(Array.isArray(badgeResult.rewards) ? badgeResult.rewards : []),
    ...(Array.isArray(achievementResult.rewards) ? achievementResult.rewards : []),
  );

  return {
    awarded: eventXpGained > 0
      || missionXpGained > 0
      || challengeXpGained > 0
      || badgeResult.unlockedBadges.length > 0
      || achievementResult.unlockedAchievements.length > 0,
    xpGained: eventXpGained
      + missionXpGained
      + challengeXpGained
      + Number(badgeResult.xpFromBadges || 0)
      + Number(achievementResult.xpFromAchievements || 0),
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
    unlockedBadges: badgeResult.unlockedBadges,
    unlockedAchievements: achievementResult.unlockedAchievements,
    rewards,
  };
};
