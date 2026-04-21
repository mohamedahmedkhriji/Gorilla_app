import type { CoachCandidate, CoachTier } from './types';

const TIER_PRIORITY: Record<CoachTier, number> = {
  silent: 0,
  affirmation: 1,
  cue: 2,
  error: 3,
  setup: 4,
  warning: 5,
};

export const getTierPriority = (tier: CoachTier) => TIER_PRIORITY[tier];

export const compareCandidates = (
  left: CoachCandidate,
  right: CoachCandidate,
) => {
  const leftPriority = getTierPriority(left.tier);
  const rightPriority = getTierPriority(right.tier);

  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence;
  }

  return left.code.localeCompare(right.code);
};

export const selectTopCandidate = (candidates: CoachCandidate[]) => {
  if (candidates.length === 0) {
    return undefined;
  }

  return [...candidates].sort(compareCandidates)[0];
};
