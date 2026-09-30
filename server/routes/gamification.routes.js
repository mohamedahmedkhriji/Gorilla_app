import express from 'express';

export const createGamificationRoutes = ({
  authMutationRateLimit,
  controller,
  requireAuth,
  requireUserAccess,
}) => {
  const router = express.Router();

  router.get('/leaderboard/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), controller.listLeaderboard);
  router.get('/missions/:userId', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.listMissions);
  router.get('/missions/:userId/history', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.listMissionHistory);
  router.get('/challenges/:userId', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), controller.listChallenges);
  router.get('/challenges/:userId/history', requireAuth('user'), requireUserAccess('userId', { allowSelf: true }), controller.listChallengeHistory);
  router.get('/gamification/:userId/summary', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.getGamificationSummary);
  router.get('/user-rank/:userId', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.getUserRank);
  router.post('/mission-progress', authMutationRateLimit, requireAuth('user'), requireUserAccess((req) => req.body?.userId, { allowSelf: true }), controller.updateMissionProgress);
  router.get('/gamification/:userId/progression', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.getGamificationProgression);
  router.get('/gamification/:userId/debug-metrics', requireAuth('user', 'coach', 'gym_owner'), requireUserAccess('userId', {
    allowSelf: true,
    allowAssignedCoach: true,
    allowGymOwner: true,
  }), controller.getGamificationDebugMetrics);

  return router;
};

export default createGamificationRoutes;
