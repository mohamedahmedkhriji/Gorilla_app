import { recordMetricScores } from './scoring';
import { TRACKER_CONFIG } from './trackerConfig';
import type {
  ActiveRepWindow,
  ExerciseEngineState,
  ExerciseScores,
} from '../types/tracking';

type MetricScoreMap = Omit<ExerciseScores, 'overall'>;

export const beginRepWindow = (timestampMs: number): ActiveRepWindow => ({
  startedAt: timestampMs,
  bestRomScore: 0,
  lowestSymmetryScore: 100,
  lowestStabilityScore: 100,
  lowestControlScore: 100,
  topReached: false,
  oneSideDominant: false,
  peakConcentricSpeed: 0,
  peakEccentricSpeed: 0,
});

export const transitionPhase = (
  state: ExerciseEngineState,
  phase: string,
  timestampMs: number,
  updates: Partial<ExerciseEngineState> = {},
): ExerciseEngineState => (
  state.phase === phase
    ? {
      ...state,
      ...updates,
    }
    : {
      ...state,
      ...updates,
      phase,
      phaseStartedAt: timestampMs,
    }
);

export const mergeActiveRepScores = (
  activeRep: ActiveRepWindow | null,
  scores: MetricScoreMap,
  motion: {
    concentricSpeed: number;
    eccentricSpeed: number;
    oneSideDominant?: boolean;
  },
): ActiveRepWindow | null => {
  if (!activeRep) {
    return null;
  }

  return {
    ...activeRep,
    bestRomScore: Math.max(activeRep.bestRomScore, scores.rangeOfMotion),
    lowestSymmetryScore: Math.min(activeRep.lowestSymmetryScore, scores.symmetry),
    lowestStabilityScore: Math.min(activeRep.lowestStabilityScore, scores.stability),
    lowestControlScore: Math.min(activeRep.lowestControlScore, scores.control),
    oneSideDominant: activeRep.oneSideDominant || Boolean(motion.oneSideDominant),
    peakConcentricSpeed: Math.max(activeRep.peakConcentricSpeed, motion.concentricSpeed),
    peakEccentricSpeed: Math.max(activeRep.peakEccentricSpeed, motion.eccentricSpeed),
  };
};

export const canCountRep = (
  lastRepTimestamp: number | null,
  timestampMs: number,
) => (
  lastRepTimestamp === null
  || timestampMs - lastRepTimestamp >= TRACKER_CONFIG.general.repCooldownMs
);

export const finalizeRepState = ({
  state,
  timestampMs,
  phase,
  repScores,
  isValid,
  feedback,
  feedbackKey,
}: {
  state: ExerciseEngineState;
  timestampMs: number;
  phase: string;
  repScores: MetricScoreMap;
  isValid: boolean;
  feedback: string;
  feedbackKey: string;
}): ExerciseEngineState => ({
  ...state,
  phase,
  phaseStartedAt: timestampMs,
  repCount: state.repCount + 1,
  validRepCount: state.validRepCount + (isValid ? 1 : 0),
  lastRepTimestamp: timestampMs,
  lastFeedback: feedback,
  lastFeedbackKey: feedbackKey,
  lastFeedbackTimestamp: timestampMs,
  metrics: recordMetricScores(state.metrics, repScores),
  mistakeCounts: isValid
    ? state.mistakeCounts
    : {
      ...state.mistakeCounts,
      [feedbackKey]: (state.mistakeCounts[feedbackKey] || 0) + 1,
    },
  history: [
    ...state.history.slice(-11),
    {
      timestampMs,
      isValid,
      feedback,
    },
  ],
  activeRep: null,
  lostFrameCount: 0,
});
