import type { ExerciseType, MovementOutput, RepResult } from '../movement/types';

export type { ExerciseType, MovementOutput, RepResult };

export type SessionPhase =
  | 'sessionIdle'
  | 'setActive'
  | 'setRest'
  | 'setComplete'
  | 'sessionComplete';

export type RepQualityLabel =
  | 'perfect'
  | 'good'
  | 'acceptable'
  | 'poor'
  | 'invalid';

export type FatigueTrend = 'romDrop' | 'controlDrop' | 'stabilityDrop' | 'symmetryDrop';

export type RepCategoryScore = {
  rom: number;
  symmetry: number;
  stability: number;
  control: number;
  overall: number;
};

export type RepMetricSnapshot = RepResult['metrics'];

export type RepRecord = {
  repNumber: number;
  setNumber: number;
  valid: boolean;
  quality: RepQualityLabel;
  completedAt: number;
  metrics: RepMetricSnapshot;
  score: RepCategoryScore;
  notes?: string[];
};

export type FatigueStatus = {
  detected: boolean;
  confidence: number;
  trend?: FatigueTrend;
  reason?: string;
};

export type SetScore = {
  repCount: number;
  validRepCount: number;
  invalidRepCount: number;
  average: RepCategoryScore;
  bestRep?: number;
  worstRep?: number;
  dominantIssue?: string;
  fatigueTrend?: {
    detected: boolean;
    confidence: number;
    reason?: string;
  };
};

export type SessionOutput = {
  sessionPhase: SessionPhase;
  exercise: ExerciseType;
  currentSet: number;
  currentRep: number;
  targetReps?: number;
  targetSets?: number;
  repJustLogged: boolean;
  setJustCompleted: boolean;
  sessionJustCompleted: boolean;
  currentSetScore?: SetScore;
  completedSetScores: SetScore[];
  repHistory: RepRecord[];
  fatigue: FatigueStatus;
  debug: {
    validRepRatio: number;
    recentRomAverage?: number;
    recentControlAverage?: number;
  };
};

export type SessionConfig = {
  targetReps?: number;
  targetSets?: number;
  autoCompleteSetOnTarget?: boolean;
  restDurationMs?: number;
};

export interface SessionThresholds {
  idealRom: number;
  minimumRom: number;
  perfectAsymmetryMax: number;
  acceptableAsymmetryMax: number;
  perfectTorsoLeanMax: number;
  acceptableTorsoLeanMax: number;
  perfectControlMin: number;
  acceptableControlMin: number;
  idealRepDurationMs: number;
  minimumRepDurationMs: number;
  maximumRepDurationMs: number;
  overallWeights: {
    rom: number;
    symmetry: number;
    stability: number;
    control: number;
  };
  qualityCutoffs: {
    perfect: number;
    good: number;
    acceptable: number;
  };
  issueThresholds: {
    romScoreMax: number;
    symmetryScoreMax: number;
    stabilityScoreMax: number;
    controlScoreMax: number;
  };
  fatigue: {
    windowSize: number;
    minimumValidReps: number;
    romDropRatio: number;
    controlDropRatio: number;
    stabilityDropRatio: number;
    symmetryDropRatio: number;
  };
}
