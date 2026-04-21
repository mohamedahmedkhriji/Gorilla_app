import type { ExerciseType } from '../movement/types';
import { SESSION_THRESHOLDS } from './sessionThresholds';
import type { FatigueStatus, RepRecord } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const isConsistentDecline = (values: number[]) => (
  values.length >= 3
  && values[0] > values[1]
  && values[1] >= values[2]
);

const buildStatus = (
  trend: FatigueStatus['trend'],
  ratio: number,
  threshold: number,
  reason: string,
): FatigueStatus => ({
  detected: true,
  confidence: clamp(ratio / Math.max(threshold, 0.0001), 0, 1),
  trend,
  reason,
});

export const detectFatigueTrend = (
  exercise: ExerciseType,
  records: RepRecord[],
): FatigueStatus => {
  const thresholds = SESSION_THRESHOLDS[exercise].fatigue;
  const validRecords = records.filter((record) => record.valid);

  if (validRecords.length < thresholds.minimumValidReps) {
    return {
      detected: false,
      confidence: 0,
    };
  }

  const recent = validRecords.slice(-thresholds.windowSize);

  if (recent.length < thresholds.windowSize) {
    return {
      detected: false,
      confidence: 0,
    };
  }

  const romValues = recent.map((record) => record.metrics.rom);
  const controlValues = recent.map((record) => record.score.control);
  const stabilityValues = recent.map((record) => record.score.stability);
  const symmetryValues = recent.map((record) => record.score.symmetry);
  const lastIndex = recent.length - 1;

  const romDrop = (romValues[0] - romValues[lastIndex]) / Math.max(romValues[0], 0.0001);
  const controlDrop = (controlValues[0] - controlValues[lastIndex]) / Math.max(controlValues[0], 1);
  const stabilityDrop = (stabilityValues[0] - stabilityValues[lastIndex]) / Math.max(stabilityValues[0], 1);
  const symmetryDrop = (symmetryValues[0] - symmetryValues[lastIndex]) / Math.max(symmetryValues[0], 1);

  const candidates: FatigueStatus[] = [];

  if (isConsistentDecline(romValues) && romDrop >= thresholds.romDropRatio) {
    candidates.push(buildStatus(
      'romDrop',
      romDrop,
      thresholds.romDropRatio,
      `ROM dropped by ${Math.round(romDrop * 100)}% over last ${recent.length} valid reps`,
    ));
  }

  if (isConsistentDecline(controlValues) && controlDrop >= thresholds.controlDropRatio) {
    candidates.push(buildStatus(
      'controlDrop',
      controlDrop,
      thresholds.controlDropRatio,
      'Control score declined consistently across recent valid reps',
    ));
  }

  if (isConsistentDecline(stabilityValues) && stabilityDrop >= thresholds.stabilityDropRatio) {
    candidates.push(buildStatus(
      'stabilityDrop',
      stabilityDrop,
      thresholds.stabilityDropRatio,
      'Stability score worsened across recent valid reps',
    ));
  }

  if (isConsistentDecline(symmetryValues) && symmetryDrop >= thresholds.symmetryDropRatio) {
    candidates.push(buildStatus(
      'symmetryDrop',
      symmetryDrop,
      thresholds.symmetryDropRatio,
      'Symmetry score worsened across recent valid reps',
    ));
  }

  if (candidates.length === 0) {
    return {
      detected: false,
      confidence: 0,
    };
  }

  return candidates.sort((left, right) => right.confidence - left.confidence)[0];
};

export const getRecentAverages = (
  exercise: ExerciseType,
  records: RepRecord[],
) => {
  const windowSize = SESSION_THRESHOLDS[exercise].fatigue.windowSize;
  const recentValid = records.filter((record) => record.valid).slice(-windowSize);

  if (recentValid.length === 0) {
    return {};
  }

  return {
    recentRomAverage: average(recentValid.map((record) => record.metrics.rom)),
    recentControlAverage: average(recentValid.map((record) => record.score.control)),
  };
};
