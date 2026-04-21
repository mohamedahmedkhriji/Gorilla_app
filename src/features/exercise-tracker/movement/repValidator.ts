import type { RepAccumulator, RepResult, MovementThresholds } from './types';

const buildMetrics = (accumulator: RepAccumulator) => {
  const durationMs = Math.max(0, accumulator.lastTimestamp - accumulator.startedAt);
  const rom = Math.max(0, accumulator.maxPrimarySignal - accumulator.minPrimarySignal);
  const controlScore = accumulator.controlSamples > 0
    ? accumulator.controlTotal / accumulator.controlSamples
    : 0;

  return {
    rom,
    peakReached: accumulator.peakReached,
    durationMs,
    concentricDurationMs: accumulator.concentricDurationMs,
    peakDurationMs: accumulator.peakDurationMs,
    eccentricDurationMs: accumulator.eccentricDurationMs,
    asymmetry: accumulator.maxAsymmetry,
    torsoLeanMax: accumulator.maxTorsoLean,
    controlScore,
  };
};

const getReason = (args: {
  rom: number;
  durationMs: number;
  invalidFrameRatio: number;
  leftDelta: number;
  rightDelta: number;
  asymmetry: number;
  torsoLean: number;
  controlScore: number;
  accumulator: RepAccumulator;
  thresholds: MovementThresholds;
}) => {
  if (args.invalidFrameRatio > args.thresholds.maxInvalidFrameRatio) {
    return 'low_confidence';
  }

  if (!args.accumulator.hasConcentric || !args.accumulator.hasPeak || !args.accumulator.hasEccentric) {
    return 'incomplete_cycle';
  }

  if (!args.accumulator.peakReached || args.rom < args.thresholds.minimumRom) {
    return 'low_rom';
  }

  if (args.durationMs < args.thresholds.minimumRepDurationMs) {
    return 'too_fast';
  }

  if (
    args.accumulator.concentricDurationMs < args.thresholds.minimumConcentricMs
    || args.accumulator.peakDurationMs < args.thresholds.minimumPeakDurationMs
    || args.accumulator.eccentricDurationMs < args.thresholds.minimumEccentricMs
  ) {
    return 'phase_duration';
  }

  if (
    args.leftDelta < args.thresholds.oneArmSignalDelta
    || args.rightDelta < args.thresholds.oneArmSignalDelta
  ) {
    return 'one_sided';
  }

  if (args.asymmetry > args.thresholds.asymmetryTolerance) {
    return 'asymmetry';
  }

  if (args.torsoLean > args.thresholds.torsoLeanTolerance) {
    return 'torso_lean';
  }

  if (args.controlScore < args.thresholds.controlScoreMin) {
    return 'poor_control';
  }

  if (args.accumulator.phaseInstabilityCount > 5) {
    return 'unstable_transition';
  }

  return null;
};

export const validateRep = (
  accumulator: RepAccumulator,
  thresholds: MovementThresholds,
): RepResult => {
  const metrics = buildMetrics(accumulator);
  const totalConfidenceFrames = accumulator.validConfidenceFrames + accumulator.invalidConfidenceFrames;
  const invalidFrameRatio = totalConfidenceFrames > 0
    ? accumulator.invalidConfidenceFrames / totalConfidenceFrames
    : 1;

  const reason = getReason({
    rom: metrics.rom,
    durationMs: metrics.durationMs,
    invalidFrameRatio,
    leftDelta: accumulator.leftMaxDelta,
    rightDelta: accumulator.rightMaxDelta,
    asymmetry: accumulator.maxAsymmetry,
    torsoLean: accumulator.maxTorsoLean,
    controlScore: metrics.controlScore,
    accumulator,
    thresholds,
  });

  return {
    valid: reason === null,
    reason: reason ?? undefined,
    repNumber: accumulator.attemptNumber,
    metrics,
  };
};

export const createInvalidRepResult = (
  accumulator: RepAccumulator,
  reason: string,
): RepResult => {
  const metrics = buildMetrics(accumulator);

  return {
    valid: false,
    reason,
    repNumber: accumulator.attemptNumber,
    metrics,
  };
};
