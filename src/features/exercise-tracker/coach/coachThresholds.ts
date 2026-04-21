import type { ExerciseType } from '../movement/types';
import type { CoachThresholds } from './types';

const LATERAL_RAISE_THRESHOLDS: CoachThresholds = {
  minimumConfidenceForWarning: 0.55,
  minimumConfidenceForCorrection: 0.68,
  minGapBetweenMessagesMs: 1000,
  sameMessageCooldownMs: 4200,
  cueCooldownMs: 900,
  affirmationCooldownMs: 6000,
  errorPersistenceMs: 1500,
  setupPersistenceMs: 1700,
  warningPersistenceMs: 1500,
  cuePersistenceMs: 900,
  affirmationPersistenceMs: 1200,
  affirmationRepOverallMin: 88,
  affirmationSetOverallMin: 82,
  cleanRepStreakForAffirmation: 2,
  lateralRaise: {
    setupPrimaryMax: -0.1,
    cueApproachPeakPrimary: -0.06,
    lowPeakPrimary: -0.09,
    highVelocitySignal: 0.7,
  },
};

const SHOULDER_PRESS_THRESHOLDS: CoachThresholds = {
  minimumConfidenceForWarning: 0.55,
  minimumConfidenceForCorrection: 0.68,
  minGapBetweenMessagesMs: 1000,
  sameMessageCooldownMs: 4200,
  cueCooldownMs: 900,
  affirmationCooldownMs: 6000,
  errorPersistenceMs: 1500,
  setupPersistenceMs: 1700,
  warningPersistenceMs: 1500,
  cuePersistenceMs: 900,
  affirmationPersistenceMs: 1200,
  affirmationRepOverallMin: 88,
  affirmationSetOverallMin: 82,
  cleanRepStreakForAffirmation: 2,
  shoulderPress: {
    setupPrimaryMax: 134,
    cueApproachPeakPrimary: 146,
    lowPeakPrimary: 144,
    highVelocitySignal: 26,
  },
};

export const COACH_THRESHOLDS: Record<ExerciseType, CoachThresholds> = {
  lateralRaise: LATERAL_RAISE_THRESHOLDS,
  shoulderPress: SHOULDER_PRESS_THRESHOLDS,
};
