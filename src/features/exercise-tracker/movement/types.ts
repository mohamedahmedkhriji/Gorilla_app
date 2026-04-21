import type { ProcessedFrame } from '../signal/processFrame';

export type ExerciseType = 'lateralRaise' | 'shoulderPress';

export type MovementPhase =
  | 'idle'
  | 'setup'
  | 'ready'
  | 'concentric'
  | 'peak'
  | 'eccentric'
  | 'repComplete';

export type RepResult = {
  valid: boolean;
  reason?: string;
  repNumber: number;
  metrics: {
    rom: number;
    peakReached: boolean;
    durationMs: number;
    concentricDurationMs: number;
    peakDurationMs: number;
    eccentricDurationMs: number;
    asymmetry: number;
    torsoLeanMax: number;
    controlScore: number;
  };
};

export type MovementOutput = {
  exercise: ExerciseType;
  phase: MovementPhase;
  stablePhase: MovementPhase;
  phaseFrames: number;
  repCount: number;
  repInProgress: boolean;
  repJustCompleted: boolean;
  repResult?: RepResult;
  validSetup: boolean;
  confidence: number;
  debug: {
    rawPhase: MovementPhase;
    primarySignal: number;
    velocitySignal: number;
    velocityDirection: 'positive' | 'negative' | 'neutral';
    thresholdName?: string;
  };
};

export interface MovementThresholds {
  minimumConfidence: number;
  setupDwellFrames: number;
  readyDwellFrames: number;
  phaseConfirmFrames: number;
  peakDwellFrames: number;
  repCompleteFrames: number;
  directionConfirmFrames: number;
  repCooldownFrames: number;
  maxInvalidFrames: number;
  concentricMinFrames: number;
  peakMinFrames: number;
  eccentricMinFrames: number;
  startPrimaryEnterMax: number;
  startPrimaryExitMax: number;
  peakPrimaryEnterMin: number;
  peakPrimaryExitMin: number;
  positiveVelocityEnter: number;
  positiveVelocityExit: number;
  negativeVelocityEnter: number;
  negativeVelocityExit: number;
  peakVelocityEnterAbsMax: number;
  peakVelocityExitAbsMax: number;
  movementMagnitudeMin: number;
  setupVelocityAbsMax: number;
  readySymmetryMax: number;
  readyTorsoLeanMax: number;
  minimumRom: number;
  asymmetryTolerance: number;
  torsoLeanTolerance: number;
  minimumRepDurationMs: number;
  minimumConcentricMs: number;
  minimumPeakDurationMs: number;
  minimumEccentricMs: number;
  maxInvalidFrameRatio: number;
  controlScoreMin: number;
  oneArmSignalDelta: number;
  controlPrimaryPenalty: number;
  controlVelocityPenalty: number;
  startSecondaryEnterMin?: number;
  startSecondaryEnterMax?: number;
  startSecondaryExitMin?: number;
  startSecondaryExitMax?: number;
  peakSecondaryEnterMin?: number;
  peakSecondaryExitMin?: number;
}

export interface RepAccumulator {
  attemptNumber: number;
  startedAt: number;
  lastTimestamp: number;
  startPrimarySignal: number;
  minPrimarySignal: number;
  maxPrimarySignal: number;
  leftStartSignal: number;
  rightStartSignal: number;
  leftMaxDelta: number;
  rightMaxDelta: number;
  maxAsymmetry: number;
  maxTorsoLean: number;
  controlTotal: number;
  controlSamples: number;
  concentricDurationMs: number;
  peakDurationMs: number;
  eccentricDurationMs: number;
  validConfidenceFrames: number;
  invalidConfidenceFrames: number;
  phaseInstabilityCount: number;
  peakReached: boolean;
  hasConcentric: boolean;
  hasPeak: boolean;
  hasEccentric: boolean;
}

export interface MovementSignals {
  primarySignal: number;
  velocitySignal: number;
  movementMagnitude: number;
  controlSample: number;
  velocityDirection: 'positive' | 'negative' | 'neutral';
  nextPositiveFrames: number;
  nextNegativeFrames: number;
  leftSignal: number;
  rightSignal: number;
  asymmetry: number;
  torsoLean: number;
  validSetup: boolean;
  nearPeak: boolean;
  canMoveConcentric: boolean;
  canMoveEccentric: boolean;
  thresholdName?: string;
  rawPhase: MovementPhase;
}

export interface MovementState {
  exercise: ExerciseType;
  stablePhase: MovementPhase;
  rawPhase: MovementPhase;
  phaseFrames: number;
  candidatePhase: MovementPhase | null;
  candidateFrames: number;
  repCount: number;
  repAttemptCount: number;
  repInProgress: boolean;
  repJustCompleted: boolean;
  repResult?: RepResult;
  validSetup: boolean;
  confidence: number;
  debug: MovementOutput['debug'];
  directionPositiveFrames: number;
  directionNegativeFrames: number;
  cooldownFramesRemaining: number;
  repAccumulator: RepAccumulator | null;
  lastFrame: ProcessedFrame | null;
  lastPrimarySignal: number | null;
}

export type MovementUpdateContext = {
  frame: ProcessedFrame;
  state: MovementState;
  thresholds: MovementThresholds;
};
