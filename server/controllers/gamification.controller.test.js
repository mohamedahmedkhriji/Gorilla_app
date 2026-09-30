import assert from 'node:assert/strict';
import test from 'node:test';
import { createGamificationController } from './gamification.controller.js';

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const baseRefreshed = () => ({
  userId: 12,
  totalPoints: 340,
  missionPoints: 120,
  challengePoints: 80,
  blogPoints: 20,
  rank: 'Bronze',
  nextRank: { name: 'Silver' },
  totalWorkouts: 9,
  completedMissions: 2,
  completedChallenges: 1,
  missions: [
    { id: 1, status: 'active', title: 'Train' },
    { id: 2, status: 'expired', title: 'Old mission' },
  ],
  challenges: [
    { id: 3, challenge_type: 'daily', status: 'active', completed: false },
    { id: 4, challenge_type: 'weekly', status: 'completed', completed: true },
    { id: 5, challenge_type: 'weekly', status: 'expired', completed: false },
  ],
});

const makeController = (overrides = {}) => createGamificationController({
  buildGamificationSummary: async () => ({
    progress: {
      rank: { current: 'Bronze' },
      level: { levelNumber: 2 },
      streaks: { workout: { current: 3 } },
      rivalry: { currentRankPosition: 1 },
    },
    activeMissionList: [{ id: 1 }],
    missionChains: [{ chainId: 'weekly' }],
    nextAction: { type: 'mission' },
    notificationTriggers: [{ type: 'mission_near_complete' }],
  }),
  collectUserGamificationMetrics: async () => ({ workout_days_this_week: 2 }),
  dbPool: {
    async execute(sql, params) {
      return [[{ title: 'Completed', points_reward: 20, period: 'September 2026', params }]];
    },
  },
  enrichMissionCollection: async (missions) => missions.map((mission) => ({ ...mission, enriched: true })),
  gamificationReady: Promise.resolve(),
  getLeaderboardBundle: async ({ userId, period }) => ({
    period,
    leaderboard: [{ id: userId, points: 20, rank: 1 }],
    preview: [{ id: userId, points: 20, rank: 1 }],
    rivalry: { currentRankPosition: 1 },
    currentUser: { id: userId, points: 20, rank: 1 },
  }),
  getUserProgressionDetails: async () => ({
    snapshot: {
      totalXp: 500,
      currentLevel: { levelNumber: 3 },
      nextLevel: { levelNumber: 4 },
    },
    badges: [{ id: 1 }],
    badgeTotals: { total: 1, unlocked: 1 },
    achievements: [{ id: 2 }],
    achievementTotals: { total: 1, unlocked: 1 },
    rewards: [{ id: 3 }],
    rewardTotals: { total: 1, available: 1 },
    xpTransactions: [{ id: 4 }],
  }),
  getUserProgressionSnapshot: async () => ({
    totalXp: 500,
    currentLevel: { levelNumber: 3 },
    nextLevel: { levelNumber: 4 },
    unlockedBadges: 1,
    unlockedAchievements: 1,
    availableRewards: 1,
  }),
  refreshGamificationForUser: async () => baseRefreshed(),
  runProgressionEventSafely: async () => ({ awarded: [] }),
  toNumber: (value, fallback = null) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  },
  ...overrides,
});

test('leaderboard preserves period validation and response shape', async () => {
  const controller = makeController();
  const invalid = makeResponse();
  const valid = makeResponse();

  await controller.listLeaderboard({ params: { userId: '12' }, query: { period: 'yearly' } }, invalid);
  await controller.listLeaderboard({ params: { userId: '12' }, query: { period: 'weekly' } }, valid);

  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.error, "Invalid period. Use 'weekly', 'monthly' or 'alltime'");
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(Object.keys(valid.body), ['period', 'leaderboard', 'preview', 'rivalry', 'currentUser']);
  assert.equal(valid.body.period, 'weekly');
});

test('missions filter expired items before enrichment', async () => {
  const seen = [];
  const controller = makeController({
    enrichMissionCollection: async (missions) => {
      seen.push(...missions);
      return missions.map((mission) => ({ ...mission, enriched: true }));
    },
  });
  const res = makeResponse();

  await controller.listMissions({ params: { userId: '12' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].status, 'active');
  assert.deepEqual(res.body, [{ id: 1, status: 'active', title: 'Train', enriched: true }]);
});

test('challenges preserve daily weekly buckets and totals', async () => {
  const controller = makeController();
  const res = makeResponse();

  await controller.listChallenges({ params: { userId: '12' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.daily.map((challenge) => challenge.id), [3]);
  assert.deepEqual(res.body.weekly.map((challenge) => challenge.id), [4]);
  assert.deepEqual(res.body.totals, { completed: 1, active: 1 });
});

test('gamification summary wraps refreshed state, progression snapshot, and progression result', async () => {
  const controller = makeController();
  const res = makeResponse();

  await controller.getGamificationSummary({ params: { userId: '12' }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.userId, 12);
  assert.equal(res.body.totalPoints, 340);
  assert.equal(res.body.totalXp, 500);
  assert.equal(res.body.activeMissions, 1);
  assert.equal(res.body.activeMissionCount, 1);
  assert.equal(res.body.activeChallenges, 1);
  assert.deepEqual(res.body.progression, { awarded: [] });
});

test('gamification progression preserves details response structure', async () => {
  const controller = makeController();
  const res = makeResponse();

  await controller.getGamificationProgression({ params: { userId: '12' }, query: { txLimit: '7' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.points, { total: 340, mission: 120, challenge: 80, blog: 20 });
  assert.deepEqual(res.body.rank, { current: 'Bronze', next: { name: 'Silver' } });
  assert.equal(res.body.xp.total, 500);
  assert.deepEqual(res.body.badgeTotals, { total: 1, unlocked: 1 });
  assert.deepEqual(res.body.xpTransactions, [{ id: 4 }]);
});
