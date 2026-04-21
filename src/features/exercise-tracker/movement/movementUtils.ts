import type { ProcessedFrame } from '../signal/processFrame';
import type {
  ExerciseType,
  MovementOutput,
  MovementPhase,
  MovementState,
  MovementThresholds,
  RepAccumulator,
} from './types';

const MAX_CONTROL_SCORE = 100;
const MIN_CONTROL_SCORE = 0;

export const average = (left: number, right: number) => (left + right) / 2;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const lessThanOrEqualWithHysteresis = (
  value: number,
  isActive: boolean,
  enterMax: number,
  exitMax: number,
) => (isActive ? value <= exitMax : value <= enterMax);

export const greaterThanOrEqualWithHysteresis = (
  value: number,
  isActive: boolean,
  enterMin: number,
  exitMin: number,
) => (isActive ? value >= exitMin : value >= enterMin);

export const betweenWithHysteresis = (
  value: number,
  isActive: boolean,
  enterMin: number,
  enterMax: number,
  exitMin: number,
  exitMax: number,
) => {
  if (isActive) {
    return value >= exitMin && value <= exitMax;
  }

  return value >= enterMin && value <= enterMax;
};

export const getDirectionalFrames = (
  velocitySignal: number,
  previousFrames: number,
  enterThreshold: number,
  exitThreshold: number,
  direction: 'positive' | 'negative',
) => {
  if (direction === 'positive') {
    if (velocitySignal >= enterThreshold) {
      return previousFrames + 1;
    }

    if (previousFrames > 0 && velocitySignal >= exitThreshold) {
      return previousFrames + 1;
    }

    return 0;
  }

  if (velocitySignal <= enterThreshold) {
    return previousFrames + 1;
  }

  if (previousFrames > 0 && velocitySignal <= exitThreshold) {
    return previousFrames + 1;
  }

  return 0;
};

export const getVelocityDirection = (
  positiveFrames: number,
  negativeFrames: number,
): 'positive' | 'negative' | 'neutral' => {
  if (positiveFrames > 0 && negativeFrames === 0) {
    return 'positive';
  }

  if (negativeFrames > 0 && positiveFrames === 0) {
    return 'negative';
  }

  return 'neutral';
};

export const toPhaseFramesRequired = (
  phase: MovementPhase,
  thresholds: MovementThresholds,
) => {
  if (phase === 'setup') return thresholds.setupDwellFrames;
  if (phase === 'ready') return thresholds.readyDwellFrames;
  if (phase === 'peak') return thresholds.peakDwellFrames;
  if (phase === 'repComplete') return thresholds.repCompleteFrames;
  if (phase === 'idle') return 1;
  return thresholds.phaseConfirmFrames;
};

export const createInitialMovementState = (exercise: ExerciseType): MovementState => ({
  exercise,
  stablePhase: 'idle',
  rawPhase: 'idle',
  phaseFrames: 0,
  candidatePhase: null,
  candidateFrames: 0,
  repCount: 0,
  repAttemptCount: 0,
  repInProgress: false,
  repJustCompleted: false,
  repResult: undefined,
  validSetup: false,
  confidence: 0,
  debug: {
    rawPhase: 'idle',
    primarySignal: 0,
    velocitySignal: 0,
    velocityDirection: 'neutral',
  },
  directionPositiveFrames: 0,
  directionNegativeFrames: 0,
  cooldownFramesRemaining: 0,
  repAccumulator: null,
  lastFrame: null,
  lastPrimarySignal: null,
});

export const buildMovementOutput = (state: MovementState): MovementOutput => ({
  exercise: state.exercise,
  phase: state.stablePhase,
  stablePhase: state.stablePhase,
  phaseFrames: state.phaseFrames,
  repCount: state.repCount,
  repInProgress: state.repInProgress,
  repJustCompleted: state.repJustCompleted,
  repResult: state.repResult,
  validSetup: state.validSetup,
  confidence: state.confidence,
  debug: { ...state.debug },
});

export const isFrameReliable = (
  frame: ProcessedFrame,
  thresholds: MovementThresholds,
) => frame.valid && frame.confidence >= thresholds.minimumConfidence;

export const getMinimumPhaseFrames = (
  phase: MovementPhase,
  thresholds: MovementThresholds,
) => {
  if (phase === 'concentric') return thresholds.concentricMinFrames;
  if (phase === 'peak') return thresholds.peakMinFrames;
  if (phase === 'eccentric') return thresholds.eccentricMinFrames;
  return 0;
};

export const getSignedSignalVelocity = (
  currentSignal: number,
  previousSignal: number | null,
  currentTimestamp: number,
  previousTimestamp: number | null,
) => {
  if (previousSignal === null || previousTimestamp === null) {
    return 0;
  }

  const deltaMs = Math.max(1, currentTimestamp - previousTimestamp);
  return ((currentSignal - previousSignal) / deltaMs) * 1000;
};

export const evaluateControlSample = (
  filteredPrimary: number,
  rawPrimary: number,
  filteredVelocityLeft: number,
  rawVelocityLeft: number,
  filteredVelocityRight: number,
  rawVelocityRight: number,
  thresholds: MovementThresholds,
) => {
  const primaryPenalty = Math.abs(filteredPrimary - rawPrimary) * thresholds.controlPrimaryPenalty;
  const velocityPenalty = (
    Math.abs(filteredVelocityLeft - rawVelocityLeft)
    + Math.abs(filteredVelocityRight - rawVelocityRight)
  ) * thresholds.controlVelocityPenalty;

  return clamp(
    MAX_CONTROL_SCORE - primaryPenalty - velocityPenalty,
    MIN_CONTROL_SCORE,
    MAX_CONTROL_SCORE,
  );
};

export const beginRepAccumulator = (
  attemptNumber: number,
  timestamp: number,
  primarySignal: number,
  leftSignal: number,
  rightSignal: number,
): RepAccumulator => ({
  attemptNumber,
  startedAt: timestamp,
  lastTimestamp: timestamp,
  startPrimarySignal: primarySignal,
  minPrimarySignal: primarySignal,
  maxPrimarySignal: primarySignal,
  leftStartSignal: leftSignal,
  rightStartSignal: rightSignal,
  leftMaxDelta: 0,
  rightMaxDelta: 0,
  maxAsymmetry: 0,
  maxTorsoLean: 0,
  controlTotal: 0,
  controlSamples: 0,
  concentricDurationMs: 0,
  peakDurationMs: 0,
  eccentricDurationMs: 0,
  validConfidenceFrames: 0,
  invalidConfidenceFrames: 0,
  phaseInstabilityCount: 0,
  peakReached: false,
  hasConcentric: true,
  hasPeak: false,
  hasEccentric: false,
});

export const updateRepAccumulator = (
  accumulator: RepAccumulator,
  args: {
    frame: ProcessedFrame;
    primarySignal: number;
    leftSignal: number;
    rightSignal: number;
    asymmetry: number;
    torsoLean: number;
    controlSample: number;
    stablePhase: MovementPhase;
    stablePhaseChanged: boolean;
  },
) => {
  const deltaMs = Math.max(0, args.frame.timestamp - accumulator.lastTimestamp);

  if (args.stablePhase === 'concentric') {
    accumulator.concentricDurationMs += deltaMs;
    accumulator.hasConcentric = true;
  } else if (args.stablePhase === 'peak') {
    accumulator.peakDurationMs += deltaMs;
    accumulator.hasPeak = true;
    accumulator.peakReached = true;
  } else if (args.stablePhase === 'eccentric') {
    accumulator.eccentricDurationMs += deltaMs;
    accumulator.hasEccentric = true;
  }

  accumulator.minPrimarySignal = Math.min(accumulator.minPrimarySignal, args.primarySignal);
  accumulator.maxPrimarySignal = Math.max(accumulator.maxPrimarySignal, args.primarySignal);
  accumulator.leftMaxDelta = Math.max(
    accumulator.leftMaxDelta,
    Math.abs(args.leftSignal - accumulator.leftStartSignal),
  );
  accumulator.rightMaxDelta = Math.max(
    accumulator.rightMaxDelta,
    Math.abs(args.rightSignal - accumulator.rightStartSignal),
  );
  accumulator.maxAsymmetry = Math.max(accumulator.maxAsymmetry, Math.abs(args.asymmetry));
  accumulator.maxTorsoLean = Math.max(accumulator.maxTorsoLean, Math.abs(args.torsoLean));
  accumulator.controlTotal += args.controlSample;
  accumulator.controlSamples += 1;
  accumulator.lastTimestamp = args.frame.timestamp;

  if (args.frame.valid) {
    accumulator.validConfidenceFrames += 1;
  } else {
    accumulator.invalidConfidenceFrames += 1;
  }

  if (args.stablePhaseChanged) {
    accumulator.phaseInstabilityCount += 1;
  }
};

export const decrementCooldown = (state: MovementState) => {
  state.cooldownFramesRemaining = Math.max(0, state.cooldownFramesRemaining - 1);
};

export const startRepCooldown = (
  state: MovementState,
  thresholds: MovementThresholds,
) => {
  state.cooldownFramesRemaining = thresholds.repCooldownFrames;
};

export const advanceStablePhase = (
  state: MovementState,
  rawPhase: MovementPhase,
  thresholds: MovementThresholds,
) => {
  if (rawPhase === state.stablePhase) {
    return {
      stablePhase: state.stablePhase,
      phaseFrames: state.phaseFrames + 1,
      candidatePhase: null as MovementPhase | null,
      candidateFrames: 0,
      transitioned: false,
      previousStablePhase: state.stablePhase,
    };
  }

  const candidatePhase = state.candidatePhase === rawPhase ? rawPhase : rawPhase;
  const candidateFrames = state.candidatePhase === rawPhase
    ? state.candidateFrames + 1
    : 1;
  const requiredFrames = toPhaseFramesRequired(rawPhase, thresholds);

  if (candidateFrames >= requiredFrames) {
    return {
      stablePhase: rawPhase,
      phaseFrames: 1,
      candidatePhase: null as MovementPhase | null,
      candidateFrames: 0,
      transitioned: true,
      previousStablePhase: state.stablePhase,
    };
  }

  return {
    stablePhase: state.stablePhase,
    phaseFrames: state.phaseFrames,
    candidatePhase,
    candidateFrames,
    transitioned: false,
    previousStablePhase: state.stablePhase,
  };
};
