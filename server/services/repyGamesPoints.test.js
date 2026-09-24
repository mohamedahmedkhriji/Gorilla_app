import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REPY_GAME_SOURCE_TYPE,
  buildRepyGameAwardReference,
  calculateLastRepStandingPlacements,
  getRepyGamePointsForPlacement,
  isRepyGameEligibleForLeaderboardAwards,
} from './repyGamesPoints.js';

const buildParticipants = (count, overrides = {}) => {
  const winnerUserId = overrides.winnerUserId || 1;
  const participants = [{ user_id: winnerUserId, status: 'completed', total_reps: 61, duels_won: 3, lives_remaining: 1 }];
  for (let userId = 2; userId <= count; userId += 1) {
    participants.push({
      user_id: userId,
      status: 'eliminated',
      elimination_order: userId - 1,
      total_reps: 20 + userId,
      duels_won: Math.max(0, count - userId),
      lives_remaining: 0,
    });
  }
  return participants;
};

test('Last Rep Standing awards 25, 20, 10 for 3 players', () => {
  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants: buildParticipants(3),
  });

  assert.deepEqual(
    placements.map((placement) => placement.pointsAwarded),
    [25, 20, 10],
  );
  assert.deepEqual(
    placements.map((placement) => placement.placement),
    [1, 2, 3],
  );
});

test('Last Rep Standing awards 25, 20, 10, 10 for 4 players', () => {
  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants: buildParticipants(4),
  });

  assert.deepEqual(
    placements.map((placement) => placement.pointsAwarded),
    [25, 20, 10, 10],
  );
});

test('Last Rep Standing awards 25, 20, 10, 10, 10 for 5 players', () => {
  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants: buildParticipants(5),
  });

  assert.deepEqual(
    placements.map((placement) => placement.pointsAwarded),
    [25, 20, 10, 10, 10],
  );
});

test('eliminated participants still receive placement points when the game completes', () => {
  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants: buildParticipants(4),
  });

  const fourthPlace = placements.find((placement) => placement.placement === 4);
  assert.equal(fourthPlace?.pointsAwarded, 10);
});

test('abandoned players do not receive participation points', () => {
  const participants = buildParticipants(4);
  participants[3] = { ...participants[3], status: 'abandoned' };

  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants,
  });

  assert.equal(placements.some((placement) => placement.userId === participants[3].user_id), false);
  assert.deepEqual(
    placements.map((placement) => placement.pointsAwarded),
    [25, 20, 10],
  );
});

test('cancelled, abandoned, invalid, and incomplete games are not eligible for points', () => {
  for (const status of ['pending', 'active', 'cancelled', 'abandoned', 'invalid']) {
    assert.equal(isRepyGameEligibleForLeaderboardAwards({ status, winner_user_id: 1 }), false);
  }
  assert.equal(isRepyGameEligibleForLeaderboardAwards({ status: 'completed', winner_user_id: null }), false);
  assert.equal(isRepyGameEligibleForLeaderboardAwards({ status: 'completed', winner_user_id: 1 }), true);
});

test('minimum 3 valid players are required', () => {
  assert.deepEqual(
    calculateLastRepStandingPlacements({
      winnerUserId: 1,
      participants: buildParticipants(2),
    }),
    [],
  );
});

test('server calculation ignores client-supplied placement and point amount', () => {
  const participants = buildParticipants(3).map((participant) => ({
    ...participant,
    placement: 1,
    points: 999,
    pointsAwarded: 999,
  }));

  const placements = calculateLastRepStandingPlacements({
    winnerUserId: 1,
    participants,
  });

  assert.deepEqual(
    placements.map((placement) => [placement.placement, placement.pointsAwarded]),
    [[1, 25], [2, 20], [3, 10]],
  );
});

test('award references are stable for duplicate finish, reconnect, and refresh requests', () => {
  const first = buildRepyGameAwardReference(42, 7);
  const duplicate = buildRepyGameAwardReference(42, 7);
  const rematch = buildRepyGameAwardReference(43, 7);

  assert.deepEqual(first, duplicate);
  assert.equal(first?.sourceType, REPY_GAME_SOURCE_TYPE);
  assert.equal(first?.sourceId, '42');
  assert.notEqual(first?.key, rematch?.key);
});

test('point mapping is controlled by placement only', () => {
  assert.equal(getRepyGamePointsForPlacement(1), 25);
  assert.equal(getRepyGamePointsForPlacement(2), 20);
  assert.equal(getRepyGamePointsForPlacement(3), 10);
  assert.equal(getRepyGamePointsForPlacement(99), 10);
  assert.equal(getRepyGamePointsForPlacement('not-a-placement'), 0);
});
