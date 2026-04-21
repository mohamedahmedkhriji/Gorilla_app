import type { RepResult } from '../movement/types';
import type { ExerciseType } from '../movement/types';
import { SESSION_THRESHOLDS } from './sessionThresholds';
import type { RepCategoryScore, RepRecord, SessionThresholds, SetScore } from './types';

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const INVALID_OVERALL_CAP = 35;

const clamp = (value: number) => Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));

const scoreFromLowerBound = (value: number, minimum: number, ideal: number) => {
  if (value <= minimum) {
    return MIN_SCORE;
  }

  if (value >= ideal) {
    return MAX_SCORE;
  }

  return clamp(((value - minimum) / Math.max(ideal - minimum, 0.0001)) * MAX_SCORE);
};

const scoreFromUpperBound = (value: number, perfectMax: number, acceptableMax: number) => {
  if (value <= perfectMax) {
    return MAX_SCORE;
  }

  if (value >= acceptableMax) {
    return MIN_SCORE;
  }

  return clamp((1 - ((value - perfectMax) / Math.max(acceptableMax - perfectMax, 0.0001))) * MAX_SCORE);
};

const scoreTempo = (
  durationMs: number,
  thresholds: SessionThresholds,
) => {
  if (durationMs <= thresholds.minimumRepDurationMs || durationMs >= thresholds.maximumRepDurationMs) {
    return MIN_SCORE;
  }

  const span = thresholds.maximumRepDurationMs - thresholds.minimumRepDurationMs;
  const distanceFromIdeal = Math.abs(durationMs - thresholds.idealRepDurationMs);

  return clamp(MAX_SCORE - ((distanceFromIdeal / Math.max(span / 2, 1)) * 100));
};

export const scoreRep = (
  exercise: ExerciseType,
  repResult: RepResult,
): RepCategoryScore => {
  const thresholds = SESSION_THRESHOLDS[exercise];
  const rom = scoreFromLowerBound(
    repResult.metrics.rom,
    thresholds.minimumRom,
    thresholds.idealRom,
  );
  const symmetry = scoreFromUpperBound(
    repResult.metrics.asymmetry,
    thresholds.perfectAsymmetryMax,
    thresholds.acceptableAsymmetryMax,
  );
  const stability = scoreFromUpperBound(
    repResult.metrics.torsoLeanMax,
    thresholds.perfectTorsoLeanMax,
    thresholds.acceptableTorsoLeanMax,
  );
  const controlBase = clamp(repResult.metrics.controlScore);
  const controlFloor = scoreFromLowerBound(
    repResult.metrics.controlScore,
    thresholds.acceptableControlMin,
    thresholds.perfectControlMin,
  );
  const tempo = scoreTempo(repResult.metrics.durationMs, thresholds);
  const control = clamp((controlBase * 0.55) + (controlFloor * 0.2) + (tempo * 0.25));

  const weightedOverall = clamp(
    (rom * thresholds.overallWeights.rom)
    + (symmetry * thresholds.overallWeights.symmetry)
    + (stability * thresholds.overallWeights.stability)
    + (control * thresholds.overallWeights.control),
  );

  return {
    rom,
    symmetry,
    stability,
    control,
    overall: repResult.valid ? weightedOverall : Math.min(weightedOverall, INVALID_OVERALL_CAP),
  };
};

const averageScore = (records: RepRecord[], key: keyof RepCategoryScore) => {
  if (records.length === 0) {
    return 0;
  }

  return records.reduce((sum, record) => sum + record.score[key], 0) / records.length;
};

const getDominantIssue = (
  records: RepRecord[],
  thresholds: SessionThresholds,
) => {
  const noteCounts = new Map<string, number>();

  records.forEach((record) => {
    record.notes?.forEach((note) => {
      noteCounts.set(note, (noteCounts.get(note) ?? 0) + 1);
    });
  });

  let dominantNote: string | undefined;
  let dominantCount = 0;

  noteCounts.forEach((count, note) => {
    if (count > dominantCount) {
      dominantCount = count;
      dominantNote = note;
    }
  });

  if (dominantNote) {
    return dominantNote;
  }

  const categoryAverages = {
    rom: averageScore(records, 'rom'),
    symmetry: averageScore(records, 'symmetry'),
    stability: averageScore(records, 'stability'),
    control: averageScore(records, 'control'),
  };

  if (categoryAverages.rom <= thresholds.issueThresholds.romScoreMax) return 'rom';
  if (categoryAverages.symmetry <= thresholds.issueThresholds.symmetryScoreMax) return 'symmetry';
  if (categoryAverages.stability <= thresholds.issueThresholds.stabilityScoreMax) return 'stability';
  if (categoryAverages.control <= thresholds.issueThresholds.controlScoreMax) return 'control';

  return undefined;
};

export const buildSetScore = (
  exercise: ExerciseType,
  records: RepRecord[],
  fatigueTrend?: SetScore['fatigueTrend'],
): SetScore | undefined => {
  if (records.length === 0) {
    return undefined;
  }

  const thresholds = SESSION_THRESHOLDS[exercise];
  const validRepCount = records.filter((record) => record.valid).length;
  const invalidRepCount = records.length - validRepCount;
  const sortedByOverall = [...records].sort((left, right) => right.score.overall - left.score.overall);

  return {
    repCount: records.length,
    validRepCount,
    invalidRepCount,
    average: {
      rom: averageScore(records, 'rom'),
      symmetry: averageScore(records, 'symmetry'),
      stability: averageScore(records, 'stability'),
      control: averageScore(records, 'control'),
      overall: averageScore(records, 'overall'),
    },
    bestRep: sortedByOverall[0]?.repNumber,
    worstRep: sortedByOverall.at(-1)?.repNumber,
    dominantIssue: getDominantIssue(records, thresholds),
    fatigueTrend,
  };
};
