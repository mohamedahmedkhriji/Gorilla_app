import type { ProcessedFrame } from '../signal/processFrame';
import { MOVEMENT_THRESHOLDS } from './thresholds';
import type { MovementSignals, MovementState, RepResult } from './types';
import {
  advanceStablePhase,
  average,
  beginRepAccumulator,
  betweenWithHysteresis,
  buildMovementOutput,
  createInitialMovementState,
  decrementCooldown,
  evaluateControlSample,
  getDirectionalFrames,
  getMinimumPhaseFrames,
  getSignedSignalVelocity,
  getVelocityDirection,
  greaterThanOrEqualWithHysteresis,
  isFrameReliable,
  lessThanOrEqualWithHysteresis,
  startRepCooldown,
  updateRepAccumulator,
} from './movementUtils';
import { createInvalidRepResult, validateRep } from './repValidator';

const EXERCISE = 'shoulderPress';

const getAverageElbowAngle = (frame: ProcessedFrame) => average(
  frame.features.elbowAngleLeft,
  frame.features.elbowAngleRight,
);

const getAverageRawElbowAngle = (frame: ProcessedFrame) => average(
  frame.rawFeatures.elbowAngleLeft,
  frame.rawFeatures.elbowAngleRight,
);

const getAverageWristHeightRatio = (frame: ProcessedFrame) => average(
  frame.features.wristHeightRatioLeft,
  frame.features.wristHeightRatioRight,
);

const getAverageWristVelocity = (frame: ProcessedFrame) => average(
  frame.features.velocity.wristLeft,
  frame.features.velocity.wristRight,
);

const finalizeRep = (
  state: MovementState,
  repResult: RepResult,
) => {
  state.repResult = repResult;
  state.repJustCompleted = true;
  state.repInProgress = false;
  state.repAccumulator = null;
};

const evaluateRawPhase = (
  frame: ProcessedFrame,
  state: MovementState,
): MovementSignals => {
  const thresholds = MOVEMENT_THRESHOLDS.shoulderPress;
  const primarySignal = getAverageElbowAngle(frame);
  const rawPrimarySignal = getAverageRawElbowAngle(frame);
  const secondarySignal = getAverageWristHeightRatio(frame);
  const movementMagnitude = getAverageWristVelocity(frame);
  const velocitySignal = getSignedSignalVelocity(
    primarySignal,
    state.lastPrimarySignal,
    frame.timestamp,
    state.lastFrame?.timestamp ?? null,
  );
  const nextPositiveFrames = getDirectionalFrames(
    velocitySignal,
    state.directionPositiveFrames,
    thresholds.positiveVelocityEnter,
    thresholds.positiveVelocityExit,
    'positive',
  );
  const nextNegativeFrames = getDirectionalFrames(
    velocitySignal,
    state.directionNegativeFrames,
    thresholds.negativeVelocityEnter,
    thresholds.negativeVelocityExit,
    'negative',
  );
  const velocityDirection = getVelocityDirection(nextPositiveFrames, nextNegativeFrames);
  const asymmetry = frame.features.symmetryDiff;
  const torsoLean = Math.abs(frame.features.torsoLean);
  const startWindow = betweenWithHysteresis(
    secondarySignal,
    state.validSetup,
    thresholds.startSecondaryEnterMin ?? Number.NEGATIVE_INFINITY,
    thresholds.startSecondaryEnterMax ?? Number.POSITIVE_INFINITY,
    thresholds.startSecondaryExitMin ?? Number.NEGATIVE_INFINITY,
    thresholds.startSecondaryExitMax ?? Number.POSITIVE_INFINITY,
  );
  const validSetup = (
    lessThanOrEqualWithHysteresis(
      primarySignal,
      state.validSetup,
      thresholds.startPrimaryEnterMax,
      thresholds.startPrimaryExitMax,
    )
    && startWindow
    && Math.abs(velocitySignal) <= thresholds.setupVelocityAbsMax
    && asymmetry <= thresholds.readySymmetryMax
    && torsoLean <= thresholds.readyTorsoLeanMax
  );
  const nearPeak = (
    greaterThanOrEqualWithHysteresis(
      primarySignal,
      state.stablePhase === 'peak' || state.rawPhase === 'peak',
      thresholds.peakPrimaryEnterMin,
      thresholds.peakPrimaryExitMin,
    )
    && greaterThanOrEqualWithHysteresis(
      secondarySignal,
      state.stablePhase === 'peak' || state.rawPhase === 'peak',
      thresholds.peakSecondaryEnterMin ?? Number.NEGATIVE_INFINITY,
      thresholds.peakSecondaryExitMin ?? Number.NEGATIVE_INFINITY,
    )
  );
  const peakVelocityWindow = lessThanOrEqualWithHysteresis(
    Math.abs(velocitySignal),
    state.stablePhase === 'peak',
    thresholds.peakVelocityEnterAbsMax,
    thresholds.peakVelocityExitAbsMax,
  );
  const canMoveConcentric = (
    nextPositiveFrames >= thresholds.directionConfirmFrames
    && movementMagnitude >= thresholds.movementMagnitudeMin
  );
  const canMoveEccentric = (
    nextNegativeFrames >= thresholds.directionConfirmFrames
    && movementMagnitude >= thresholds.movementMagnitudeMin
  );

  let rawPhase = state.stablePhase;
  let thresholdName = 'hold';

  if (!isFrameReliable(frame, thresholds)) {
    rawPhase = state.stablePhase;
    thresholdName = 'lowConfidenceHold';
  } else if (state.repInProgress) {
    if (state.stablePhase === 'concentric') {
      if (
        state.phaseFrames >= getMinimumPhaseFrames('concentric', thresholds)
        && nearPeak
        && peakVelocityWindow
      ) {
        rawPhase = 'peak';
        thresholdName = 'peakEnter';
      } else {
        rawPhase = 'concentric';
        thresholdName = 'upwardDrive';
      }
    } else if (state.stablePhase === 'peak') {
      if (
        state.phaseFrames >= getMinimumPhaseFrames('peak', thresholds)
        && canMoveEccentric
      ) {
        rawPhase = 'eccentric';
        thresholdName = 'eccentricEnter';
      } else {
        rawPhase = 'peak';
        thresholdName = 'peakHold';
      }
    } else if (state.stablePhase === 'eccentric') {
      if (
        state.phaseFrames >= getMinimumPhaseFrames('eccentric', thresholds)
        && validSetup
        && state.repAccumulator?.hasPeak
      ) {
        rawPhase = 'repComplete';
        thresholdName = 'returnWindow';
      } else {
        rawPhase = 'eccentric';
        thresholdName = 'loweringDrive';
      }
    } else if (state.stablePhase === 'repComplete') {
      rawPhase = validSetup ? 'ready' : 'setup';
      thresholdName = validSetup ? 'readyReset' : 'setupReset';
    } else {
      rawPhase = 'concentric';
      thresholdName = 'repLock';
    }
  } else if (state.stablePhase === 'idle') {
    rawPhase = validSetup ? 'ready' : 'setup';
    thresholdName = validSetup ? 'readyWindow' : 'setupWindow';
  } else if (state.stablePhase === 'setup') {
    rawPhase = validSetup ? 'ready' : 'setup';
    thresholdName = validSetup ? 'readyWindow' : 'setupWindow';
  } else if (state.stablePhase === 'ready') {
    if (state.cooldownFramesRemaining === 0 && canMoveConcentric) {
      rawPhase = 'concentric';
      thresholdName = 'concentricEnter';
    } else if (!validSetup) {
      rawPhase = 'setup';
      thresholdName = 'startLost';
    } else {
      rawPhase = 'ready';
      thresholdName = state.cooldownFramesRemaining > 0 ? 'cooldownHold' : 'readyHold';
    }
  } else {
    rawPhase = validSetup ? 'ready' : 'setup';
    thresholdName = validSetup ? 'readyReset' : 'setupReset';
  }

  const controlSample = evaluateControlSample(
    primarySignal,
    rawPrimarySignal,
    frame.features.velocity.wristLeft,
    frame.rawFeatures.velocity.wristLeft,
    frame.features.velocity.wristRight,
    frame.rawFeatures.velocity.wristRight,
    thresholds,
  );

  return {
    primarySignal,
    velocitySignal,
    movementMagnitude,
    controlSample,
    velocityDirection,
    nextPositiveFrames,
    nextNegativeFrames,
    leftSignal: frame.features.elbowAngleLeft,
    rightSignal: frame.features.elbowAngleRight,
    asymmetry,
    torsoLean,
    validSetup,
    nearPeak,
    canMoveConcentric,
    canMoveEccentric,
    thresholdName,
    rawPhase,
  };
};

export const createShoulderPressState = () => createInitialMovementState(EXERCISE);

export const updateShoulderPressFSM = (
  frame: ProcessedFrame,
  previousState: MovementState,
): MovementState => {
  const thresholds = MOVEMENT_THRESHOLDS.shoulderPress;
  const state: MovementState = {
    ...previousState,
    repJustCompleted: false,
    repResult: undefined,
  };

  decrementCooldown(state);

  const signals = evaluateRawPhase(frame, state);

  state.rawPhase = signals.rawPhase;
  state.validSetup = signals.validSetup;
  state.confidence = frame.confidence;
  state.debug = {
    rawPhase: signals.rawPhase,
    primarySignal: signals.primarySignal,
    velocitySignal: signals.velocitySignal,
    velocityDirection: signals.velocityDirection,
    thresholdName: signals.thresholdName,
  };

  if (!isFrameReliable(frame, thresholds)) {
    if (state.repAccumulator) {
      updateRepAccumulator(state.repAccumulator, {
        frame: {
          ...frame,
          valid: false,
        },
        primarySignal: signals.primarySignal,
        leftSignal: signals.leftSignal,
        rightSignal: signals.rightSignal,
        asymmetry: signals.asymmetry,
        torsoLean: signals.torsoLean,
        controlSample: 0,
        stablePhase: state.stablePhase,
        stablePhaseChanged: false,
      });

      if (state.repAccumulator.invalidConfidenceFrames > thresholds.maxInvalidFrames) {
        finalizeRep(state, createInvalidRepResult(state.repAccumulator, 'invalid_frames_exceeded'));
        startRepCooldown(state, thresholds);
      }
    }

    state.lastFrame = frame;
    state.lastPrimarySignal = signals.primarySignal;
    return state;
  }

  state.directionPositiveFrames = signals.nextPositiveFrames;
  state.directionNegativeFrames = signals.nextNegativeFrames;

  const transition = advanceStablePhase(state, signals.rawPhase, thresholds);
  state.stablePhase = transition.stablePhase;
  state.phaseFrames = transition.phaseFrames;
  state.candidatePhase = transition.candidatePhase;
  state.candidateFrames = transition.candidateFrames;

  if (
    transition.transitioned
    && transition.stablePhase === 'concentric'
    && !state.repAccumulator
    && state.cooldownFramesRemaining === 0
  ) {
    state.repAttemptCount += 1;
    state.repAccumulator = beginRepAccumulator(
      state.repAttemptCount,
      frame.timestamp,
      signals.primarySignal,
      signals.leftSignal,
      signals.rightSignal,
    );
    state.repInProgress = true;
  }

  if (state.repAccumulator) {
    updateRepAccumulator(state.repAccumulator, {
      frame,
      primarySignal: signals.primarySignal,
      leftSignal: signals.leftSignal,
      rightSignal: signals.rightSignal,
      asymmetry: signals.asymmetry,
      torsoLean: signals.torsoLean,
      controlSample: signals.controlSample,
      stablePhase: state.stablePhase,
      stablePhaseChanged: transition.transitioned,
    });

    if (state.stablePhase === 'peak') {
      state.repAccumulator.peakReached = true;
    }
  }

  if (transition.transitioned && transition.stablePhase === 'repComplete' && state.repAccumulator) {
    const repResult = validateRep(state.repAccumulator, thresholds);
    finalizeRep(state, repResult);

    if (repResult.valid) {
      state.repCount += 1;
    }

    startRepCooldown(state, thresholds);
  } else {
    state.repInProgress = state.repAccumulator !== null;
  }

  state.lastFrame = frame;
  state.lastPrimarySignal = signals.primarySignal;

  return state;
};

export const getShoulderPressOutput = (state: MovementState) => buildMovementOutput(state);
