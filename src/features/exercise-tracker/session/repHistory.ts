import type { ExerciseType, RepResult } from '../movement/types';
import { SESSION_THRESHOLDS } from './sessionThresholds';
import { scoreRep } from './scoring';
import type { RepQualityLabel, RepRecord } from './types';

const INVALID_REASON_LABELS: Record<string, string> = {
  low_confidence: 'invalid:confidence',
  incomplete_cycle: 'invalid:incomplete_cycle',
  low_rom: 'invalid:rom',
  too_fast: 'invalid:tempo',
  phase_duration: 'invalid:phase_duration',
  one_sided: 'invalid:one_sided',
  asymmetry: 'invalid:symmetry',
  torso_lean: 'invalid:stability',
  poor_control: 'invalid:control',
  unstable_transition: 'invalid:transition',
  invalid_frames_exceeded: 'invalid:frames',
};

const getQualityLabel = (
  valid: boolean,
  overall: number,
  perfectCutoff: number,
  goodCutoff: number,
  acceptableCutoff: number,
): RepQualityLabel => {
  if (!valid) return 'invalid';
  if (overall >= perfectCutoff) return 'perfect';
  if (overall >= goodCutoff) return 'good';
  if (overall >= acceptableCutoff) return 'acceptable';
  return 'poor';
};

const getNotes = (
  exercise: ExerciseType,
  repResult: RepResult,
  score: RepRecord['score'],
) => {
  const thresholds = SESSION_THRESHOLDS[exercise];
  const notes = new Set<string>();

  if (!repResult.valid) {
    notes.add(INVALID_REASON_LABELS[repResult.reason ?? ''] ?? 'invalid:unknown');
  }

  if (score.rom <= thresholds.issueThresholds.romScoreMax) notes.add('rom');
  if (score.symmetry <= thresholds.issueThresholds.symmetryScoreMax) notes.add('symmetry');
  if (score.stability <= thresholds.issueThresholds.stabilityScoreMax) notes.add('stability');
  if (score.control <= thresholds.issueThresholds.controlScoreMax) notes.add('control');

  return notes.size > 0 ? [...notes] : undefined;
};

export const createRepRecord = (args: {
  exercise: ExerciseType;
  repResult: RepResult;
  setNumber: number;
  completedAt: number;
}): RepRecord => {
  const thresholds = SESSION_THRESHOLDS[args.exercise];
  const score = scoreRep(args.exercise, args.repResult);
  const quality = getQualityLabel(
    args.repResult.valid,
    score.overall,
    thresholds.qualityCutoffs.perfect,
    thresholds.qualityCutoffs.good,
    thresholds.qualityCutoffs.acceptable,
  );

  return {
    repNumber: args.repResult.repNumber,
    setNumber: args.setNumber,
    valid: args.repResult.valid,
    quality,
    completedAt: args.completedAt,
    metrics: { ...args.repResult.metrics },
    score,
    notes: getNotes(args.exercise, args.repResult, score),
  };
};

export const getSetRepHistory = (
  repHistory: RepRecord[],
  setNumber: number,
) => repHistory.filter((record) => record.setNumber === setNumber);
