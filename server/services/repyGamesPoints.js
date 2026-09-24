export const REPY_GAME_SOURCE_TYPE = 'repy_game';
export const REPY_GAME_REQUIRED_MIN_PLAYERS = 3;
export const REPY_GAME_POINTS_BY_PLACEMENT = Object.freeze({
  1: 25,
  2: 20,
});
export const REPY_GAME_COMPLETION_POINTS = 10;

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getRepyGamePointsForPlacement = (placement) => {
  const normalizedPlacement = toPositiveInteger(placement);
  if (!normalizedPlacement) return 0;
  return REPY_GAME_POINTS_BY_PLACEMENT[normalizedPlacement] || REPY_GAME_COMPLETION_POINTS;
};

export const isRepyGameEligibleForLeaderboardAwards = (game) => {
  const status = String(game?.status || '').trim().toLowerCase();
  const winnerUserId = toPositiveInteger(game?.winner_user_id ?? game?.winnerUserId);
  return status === 'completed' && Boolean(winnerUserId);
};

export const buildRepyGameAwardReference = (gameId, userId) => {
  const normalizedGameId = toPositiveInteger(gameId);
  const normalizedUserId = toPositiveInteger(userId);
  if (!normalizedGameId || !normalizedUserId) return null;
  return {
    sourceType: REPY_GAME_SOURCE_TYPE,
    sourceId: String(normalizedGameId),
    userId: normalizedUserId,
    key: `${REPY_GAME_SOURCE_TYPE}:${normalizedGameId}:${normalizedUserId}`,
  };
};

export const calculateLastRepStandingPlacements = ({
  winnerUserId,
  participants,
  minimumPlayers = REPY_GAME_REQUIRED_MIN_PLAYERS,
} = {}) => {
  const normalizedWinnerId = toPositiveInteger(winnerUserId);
  const normalizedParticipants = (Array.isArray(participants) ? participants : [])
    .map((participant) => {
      const userId = toPositiveInteger(participant?.user_id ?? participant?.userId);
      if (!userId) return null;
      const status = String(participant?.status || 'completed').trim().toLowerCase();
      const abandoned = Boolean(participant?.abandoned || participant?.is_abandoned)
        || status === 'abandoned'
        || status === 'cancelled';
      return {
        ...participant,
        userId,
        status,
        abandoned,
        eliminationOrder: toFiniteNumber(participant?.elimination_order ?? participant?.eliminationOrder, 0),
        eliminatedAt: participant?.eliminated_at ?? participant?.eliminatedAt ?? null,
      };
    })
    .filter(Boolean);

  const eligibleParticipants = normalizedParticipants.filter((participant) => !participant.abandoned);
  if (!normalizedWinnerId || eligibleParticipants.length < minimumPlayers) {
    return [];
  }

  const winner = eligibleParticipants.find((participant) => participant.userId === normalizedWinnerId);
  if (!winner) return [];

  const eliminatedParticipants = eligibleParticipants
    .filter((participant) => participant.userId !== normalizedWinnerId)
    .sort((left, right) => {
      const leftOrder = left.eliminationOrder || Number.MAX_SAFE_INTEGER;
      const rightOrder = right.eliminationOrder || Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return rightOrder - leftOrder;

      const leftTime = left.eliminatedAt ? new Date(left.eliminatedAt).getTime() : 0;
      const rightTime = right.eliminatedAt ? new Date(right.eliminatedAt).getTime() : 0;
      if (leftTime !== rightTime) return rightTime - leftTime;

      return left.userId - right.userId;
    });

  return [winner, ...eliminatedParticipants].map((participant, index) => {
    const placement = index + 1;
    return {
      userId: participant.userId,
      placement,
      pointsAwarded: getRepyGamePointsForPlacement(placement),
      totalReps: Math.max(0, Math.floor(toFiniteNumber(participant.total_reps ?? participant.totalReps, 0))),
      duelsWon: Math.max(0, Math.floor(toFiniteNumber(participant.duels_won ?? participant.duelsWon, 0))),
      livesRemaining: Math.max(0, Math.floor(toFiniteNumber(participant.lives_remaining ?? participant.livesRemaining, 0))),
    };
  });
};

export const buildRepyGameAwardAnalyticsEvent = ({
  gameId,
  userId,
  placement,
  pointsAwarded,
  gameDuration,
  playerCount,
} = {}) => ({
  eventName: 'repy_game_points_awarded',
  properties: {
    gameId: toPositiveInteger(gameId),
    userId: toPositiveInteger(userId),
    placement: toPositiveInteger(placement),
    pointsAwarded: Math.max(0, Math.floor(toFiniteNumber(pointsAwarded, 0))),
    gameDuration: Math.max(0, Math.floor(toFiniteNumber(gameDuration, 0))),
    playerCount: Math.max(0, Math.floor(toFiniteNumber(playerCount, 0))),
  },
});
