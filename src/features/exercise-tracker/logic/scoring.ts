import type {
  ActiveRepWindow,
  ExerciseScoreAccumulators,
  ExerciseScores,
  ScoreAccumulator,
} from '../types/tracking';

type MetricScoreKey = keyof Omit<ExerciseScores, 'overall'>;
type MetricScoreMap = Record<MetricScoreKey, number>;

export const clampScore = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

export const scoreFromLowerBound = (
  value: number | null,
  idealMinimum: number,
  failMinimum: number,
) => {
  if (value === null) return 0;
  if (value >= idealMinimum) return 100;
  if (value <= failMinimum) return 0;

  return clampScore(
    ((value - failMinimum) / Math.max(0.0001, idealMinimum - failMinimum)) * 100,
  );
};

export const scoreFromUpperBound = (
  value: number | null,
  idealMaximum: number,
  failMaximum: number,
) => {
  if (value === null) return 0;
  if (value <= idealMaximum) return 100;
  if (value >= failMaximum) return 0;

  return clampScore(
    (1 - ((value - idealMaximum) / Math.max(0.0001, failMaximum - idealMaximum))) * 100,
  );
};

export const createScoreAccumulator = (): ScoreAccumulator => ({
  total: 0,
  count: 0,
});

export const createScoreAccumulators = (): ExerciseScoreAccumulators => ({
  rangeOfMotion: createScoreAccumulator(),
  symmetry: createScoreAccumulator(),
  stability: createScoreAccumulator(),
  control: createScoreAccumulator(),
});

export const appendScoreSample = (
  accumulator: ScoreAccumulator,
  score: number,
): ScoreAccumulator => ({
  total: accumulator.total + clampScore(score),
  count: accumulator.count + 1,
});

export const recordMetricScores = (
  accumulators: ExerciseScoreAccumulators,
  scores: MetricScoreMap,
): ExerciseScoreAccumulators => ({
  rangeOfMotion: appendScoreSample(accumulators.rangeOfMotion, scores.rangeOfMotion),
  symmetry: appendScoreSample(accumulators.symmetry, scores.symmetry),
  stability: appendScoreSample(accumulators.stability, scores.stability),
  control: appendScoreSample(accumulators.control, scores.control),
});

const averageAccumulator = (accumulator: ScoreAccumulator) => (
  accumulator.count ? accumulator.total / accumulator.count : 0
);

const toExerciseScores = (scores: MetricScoreMap): ExerciseScores => {
  const overall =
    (scores.rangeOfMotion + scores.symmetry + scores.stability + scores.control) / 4;

  return {
    ...scores,
    overall: clampScore(overall),
  };
};

export const buildPreviewScores = (
  accumulators: ExerciseScoreAccumulators,
  activeRep: ActiveRepWindow | null,
): ExerciseScores => {
  const rangeOfMotionBase = averageAccumulator(accumulators.rangeOfMotion);
  const symmetryBase = averageAccumulator(accumulators.symmetry);
  const stabilityBase = averageAccumulator(accumulators.stability);
  const controlBase = averageAccumulator(accumulators.control);

  const rangeOfMotion = activeRep
    ? (rangeOfMotionBase * accumulators.rangeOfMotion.count + activeRep.bestRomScore)
      / (accumulators.rangeOfMotion.count + 1)
    : rangeOfMotionBase;
  const symmetry = activeRep
    ? (symmetryBase * accumulators.symmetry.count + activeRep.lowestSymmetryScore)
      / (accumulators.symmetry.count + 1)
    : symmetryBase;
  const stability = activeRep
    ? (stabilityBase * accumulators.stability.count + activeRep.lowestStabilityScore)
      / (accumulators.stability.count + 1)
    : stabilityBase;
  const control = activeRep
    ? (controlBase * accumulators.control.count + activeRep.lowestControlScore)
      / (accumulators.control.count + 1)
    : controlBase;

  return toExerciseScores({
    rangeOfMotion: clampScore(rangeOfMotion),
    symmetry: clampScore(symmetry),
    stability: clampScore(stability),
    control: clampScore(control),
  });
};

export const buildFinalScores = (
  accumulators: ExerciseScoreAccumulators,
): ExerciseScores => buildPreviewScores(accumulators, null);

export const getMostCommonMistake = (mistakeCounts: Record<string, number>) => {
  const entries = Object.entries(mistakeCounts).sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] || 'No major issues detected';
};

