import type { ExerciseType } from '../movement/types';
import type { SessionThresholds } from './types';

const LATERAL_RAISE_THRESHOLDS: SessionThresholds = {
  idealRom: 0.72,
  minimumRom: 0.42,
  perfectAsymmetryMax: 8,
  acceptableAsymmetryMax: 24,
  perfectTorsoLeanMax: 0.06,
  acceptableTorsoLeanMax: 0.24,
  perfectControlMin: 88,
  acceptableControlMin: 60,
  idealRepDurationMs: 1700,
  minimumRepDurationMs: 900,
  maximumRepDurationMs: 3600,
  overallWeights: {
    rom: 0.34,
    symmetry: 0.22,
    stability: 0.2,
    control: 0.24,
  },
  qualityCutoffs: {
    perfect: 90,
    good: 78,
    acceptable: 62,
  },
  issueThresholds: {
    romScoreMax: 70,
    symmetryScoreMax: 72,
    stabilityScoreMax: 72,
    controlScoreMax: 70,
  },
  fatigue: {
    windowSize: 3,
    minimumValidReps: 3,
    romDropRatio: 0.12,
    controlDropRatio: 0.12,
    stabilityDropRatio: 0.14,
    symmetryDropRatio: 0.12,
  },
};

const SHOULDER_PRESS_THRESHOLDS: SessionThresholds = {
  idealRom: 42,
  minimumRom: 24,
  perfectAsymmetryMax: 7,
  acceptableAsymmetryMax: 20,
  perfectTorsoLeanMax: 0.05,
  acceptableTorsoLeanMax: 0.22,
  perfectControlMin: 90,
  acceptableControlMin: 62,
  idealRepDurationMs: 1600,
  minimumRepDurationMs: 850,
  maximumRepDurationMs: 3400,
  overallWeights: {
    rom: 0.32,
    symmetry: 0.22,
    stability: 0.22,
    control: 0.24,
  },
  qualityCutoffs: {
    perfect: 90,
    good: 78,
    acceptable: 62,
  },
  issueThresholds: {
    romScoreMax: 70,
    symmetryScoreMax: 72,
    stabilityScoreMax: 72,
    controlScoreMax: 70,
  },
  fatigue: {
    windowSize: 3,
    minimumValidReps: 3,
    romDropRatio: 0.1,
    controlDropRatio: 0.12,
    stabilityDropRatio: 0.14,
    symmetryDropRatio: 0.12,
  },
};

export const SESSION_THRESHOLDS: Record<ExerciseType, SessionThresholds> = {
  lateralRaise: LATERAL_RAISE_THRESHOLDS,
  shoulderPress: SHOULDER_PRESS_THRESHOLDS,
};
