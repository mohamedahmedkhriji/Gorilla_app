import { analyzeExercise } from '../analyzeExercise';
import { validateRep } from '../repValidation';
import { buildFinalScores, getMostCommonMistake } from '../scoring';
import { applyDeadZone } from '../metrics';
import {
  beginRepWindow,
  canCountRep,
  finalizeRepState,
  mergeActiveRepScores,
  transitionPhase,
} from '../stateMachine';
import { TRACKER_CONFIG } from '../trackerConfig';
import type {
  ExerciseFrameAnalysis,
  ExerciseLogicModule,
  ExerciseSummary,
} from '../../types/tracking';
import {
  createInitialExerciseState,
  getShoulderPressMetrics,
  getTorsoDriftMetric,
} from './shared';
import { clampScore, scoreFromLowerBound, scoreFromUpperBound } from '../scoring';

const LABEL = 'Shoulder Press';

const getDebugNumber = (value: unknown) => (typeof value === 'number' ? value : null);

export const shoulderPressModule: ExerciseLogicModule = {
  exercise: 'shoulder-press',
  label: LABEL,
  createInitialState: () => createInitialExerciseState(
    'start',
    'Get ready',
  ),
  analyzeFrame: (frame, state): ExerciseFrameAnalysis => {
    const metrics = getShoulderPressMetrics(frame);

    if (!metrics || metrics.averageElbowAngle === null) {
      const nextState = {
        ...state,
        coachStatus: 'warning' as const,
        lostFrameCount: state.lostFrameCount + 1,
        debug: {
          ...state.debug,
          trackingLostFrames: state.lostFrameCount + 1,
        },
      };

      return {
        nextState,
        coachStatus: 'warning',
        primaryFeedback: state.lastFeedback || 'Adjust position',
      };
    }

    const previousClearance = getDebugNumber(state.debug.previousClearanceNormalized);
    const previousTimestamp = getDebugNumber(state.debug.previousTimestampMs);
    const previousTorsoCenterX = getDebugNumber(state.debug.previousTorsoCenterX);
    const currentClearance = metrics.averageNoseClearanceNormalized ?? 0;
    const elapsedSeconds = previousTimestamp
      ? Math.max(0.016, (frame.timestampMs - previousTimestamp) / 1000)
      : null;
    const clearanceDelta = previousClearance !== null
      ? applyDeadZone(
        currentClearance - previousClearance,
        TRACKER_CONFIG.shoulderPress.motionDeadZoneNormalized,
      )
      : 0;
    const verticalVelocity = previousClearance !== null && elapsedSeconds
      ? clearanceDelta / elapsedSeconds
      : 0;
    const concentricSpeed = verticalVelocity > 0 ? verticalVelocity : 0;
    const eccentricSpeed = verticalVelocity < 0 ? Math.abs(verticalVelocity) : 0;
    const movementDirection = verticalVelocity > 0
      ? 'up'
      : verticalVelocity < 0
        ? 'down'
        : 'still';
    const torsoDrift = getTorsoDriftMetric(
      metrics.torsoCenterX,
      previousTorsoCenterX,
      frame.shoulderWidth || frame.torsoSize || frame.bodyScale,
    );

    const extensionScore = scoreFromLowerBound(
      metrics.averageElbowAngle,
      TRACKER_CONFIG.shoulderPress.topElbowExtensionDeg,
      TRACKER_CONFIG.shoulderPress.returnElbowBendDeg,
    );
    const clearanceScore = scoreFromLowerBound(
      metrics.averageNoseClearanceNormalized,
      TRACKER_CONFIG.shoulderPress.noseClearanceNormalized,
      TRACKER_CONFIG.shoulderPress.noseClearanceNormalized * 0.15,
    );
    const rangeOfMotion = Math.max(extensionScore, clearanceScore);
    const symmetryScore = scoreFromUpperBound(
      metrics.symmetryDiffNormalized,
      TRACKER_CONFIG.shoulderPress.validSymmetryDiffNormalized,
      TRACKER_CONFIG.shoulderPress.maxSymmetryDiffNormalized * 1.6,
    );
    const leanScore = scoreFromUpperBound(
      metrics.torsoDepthOffset,
      TRACKER_CONFIG.shoulderPress.validTorsoDepthOffset,
      TRACKER_CONFIG.shoulderPress.maxTorsoDepthOffset * 1.5,
    );
    const torsoDriftScore = scoreFromUpperBound(
      torsoDrift,
      0.05,
      0.14,
    );
    const alignmentScore = scoreFromUpperBound(
      metrics.averageAlignmentNormalized,
      TRACKER_CONFIG.shoulderPress.validOverheadAlignmentTolerance,
      TRACKER_CONFIG.shoulderPress.overheadAlignmentTolerance * 1.6,
    );
    const stabilityScore = clampScore((leanScore + torsoDriftScore + alignmentScore) / 3);
    const controlScore = scoreFromUpperBound(
      Math.max(concentricSpeed, eccentricSpeed),
      TRACKER_CONFIG.shoulderPress.loweringVelocityLimitNormalizedPerSec * 0.72,
      TRACKER_CONFIG.shoulderPress.loweringVelocityLimitNormalizedPerSec * 1.5,
    );

    const startPositionReady = Boolean(
      metrics.averageStartOffsetNormalized !== null
      && metrics.averageStartOffsetNormalized <= TRACKER_CONFIG.shoulderPress.pressStartOffsetTolerance
      && metrics.averageElbowAngle <= TRACKER_CONFIG.shoulderPress.returnElbowBendDeg + 12
    );
    const overheadReached = Boolean(
      metrics.averageNoseClearanceNormalized !== null
      && metrics.averageNoseClearanceNormalized >= TRACKER_CONFIG.shoulderPress.noseClearanceNormalized
      && metrics.averageElbowAngle >= TRACKER_CONFIG.shoulderPress.topElbowExtensionDeg
    );
    const oneSideDominant = Boolean(
      metrics.symmetryDiffNormalized !== null
      && metrics.symmetryDiffNormalized > TRACKER_CONFIG.shoulderPress.maxSymmetryDiffNormalized
    );

    let nextState = {
      ...state,
      lostFrameCount: 0,
      activeRep: state.activeRep ? mergeActiveRepScores(
        state.activeRep,
        {
          rangeOfMotion,
          symmetry: symmetryScore,
          stability: stabilityScore,
          control: controlScore,
        },
        {
          concentricSpeed,
          eccentricSpeed,
          oneSideDominant,
        },
      ) : null,
      debug: {
        averageElbowAngle: Number(metrics.averageElbowAngle.toFixed(1)),
        clearanceNormalized: metrics.averageNoseClearanceNormalized !== null
          ? Number(metrics.averageNoseClearanceNormalized.toFixed(3))
          : null,
        startOffsetNormalized: metrics.averageStartOffsetNormalized !== null
          ? Number(metrics.averageStartOffsetNormalized.toFixed(3))
          : null,
        symmetryDiffNormalized: metrics.symmetryDiffNormalized !== null
          ? Number(metrics.symmetryDiffNormalized.toFixed(3))
          : null,
        torsoDepthOffset: metrics.torsoDepthOffset !== null
          ? Number(metrics.torsoDepthOffset.toFixed(3))
          : null,
        torsoDrift: torsoDrift !== null ? Number(torsoDrift.toFixed(3)) : null,
        movementDirection,
        phaseDurationMs: state.phaseStartedAt !== null
          ? Math.max(0, Math.round(frame.timestampMs - state.phaseStartedAt))
          : 0,
        alignmentNormalized: metrics.averageAlignmentNormalized !== null
          ? Number(metrics.averageAlignmentNormalized.toFixed(3))
          : null,
        previousClearanceNormalized: metrics.averageNoseClearanceNormalized,
        previousTimestampMs: frame.timestampMs,
        previousTorsoCenterX: metrics.torsoCenterX ?? null,
      },
    };

    if (
      nextState.phase === 'start'
      && (
        (metrics.averageNoseClearanceNormalized ?? 0) > 0.08
        || metrics.averageElbowAngle > TRACKER_CONFIG.shoulderPress.returnElbowBendDeg + 8
      )
    ) {
      nextState = transitionPhase(nextState, 'pressing', frame.timestampMs, {
        activeRep: beginRepWindow(frame.timestampMs),
      });
    }

    if (nextState.phase === 'pressing' && overheadReached) {
      nextState = transitionPhase(nextState, 'top', frame.timestampMs, {
        activeRep: nextState.activeRep
          ? {
            ...nextState.activeRep,
            topReached: true,
          }
          : beginRepWindow(frame.timestampMs),
      });
    }

    if (nextState.phase === 'top' && verticalVelocity < -0.12) {
      nextState = transitionPhase(nextState, 'lowering', frame.timestampMs);
    }

    let repFeedbackOverride: string | null = null;
    let repStatusOverride: 'good' | 'bad' | null = null;

    if (
      nextState.phase !== 'start'
      && startPositionReady
      && canCountRep(state.lastRepTimestamp, frame.timestampMs)
    ) {
      const activeRep = nextState.activeRep;
      const repScores = {
        rangeOfMotion: Math.max(activeRep?.bestRomScore || rangeOfMotion, rangeOfMotion),
        symmetry: Math.min(activeRep?.lowestSymmetryScore || symmetryScore, symmetryScore),
        stability: Math.min(activeRep?.lowestStabilityScore || stabilityScore, stabilityScore),
        control: Math.min(activeRep?.lowestControlScore || controlScore, controlScore),
      };
      const antiCheatResult = validateRep({
        romScore: repScores.rangeOfMotion,
        symmetryScore: repScores.symmetry,
        stabilityScore: repScores.stability,
        controlScore: repScores.control,
        topReached: Boolean(activeRep?.topReached),
        oneSideDominant: Boolean(activeRep?.oneSideDominant),
        repDurationMs: frame.timestampMs - (activeRep?.startedAt || frame.timestampMs),
        minimumRepDurationMs: TRACKER_CONFIG.shoulderPress.minimumRepDurationMs,
        minimumRomScore: TRACKER_CONFIG.shoulderPress.minimumRomScore,
      });
      const feedback = antiCheatResult.validRep ? 'Good form' : antiCheatResult.reason || 'Fix your form';

      nextState = finalizeRepState({
        state: nextState,
        timestampMs: frame.timestampMs,
        phase: 'start',
        repScores,
        isValid: antiCheatResult.validRep,
        feedback,
        feedbackKey: feedback,
      });

      repFeedbackOverride = feedback;
      repStatusOverride = antiCheatResult.validRep ? 'good' : 'bad';
    } else if (
      nextState.phase !== 'start'
      && startPositionReady
      && !canCountRep(state.lastRepTimestamp, frame.timestampMs)
    ) {
      nextState = transitionPhase(nextState, 'start', frame.timestampMs, {
        activeRep: null,
      });
    }

    const phaseDurationMs = nextState.phaseStartedAt !== null
      ? Math.max(0, frame.timestampMs - nextState.phaseStartedAt)
      : 0;
    nextState = {
      ...nextState,
      debug: {
        ...nextState.debug,
        phaseDurationMs: Math.round(phaseDurationMs),
      },
    };

    const coachingDecision = repFeedbackOverride
      ? {
        status: repStatusOverride || 'bad',
        message: repFeedbackOverride,
      }
      : analyzeExercise({
        exerciseType: 'shoulder-press',
        phase: nextState.phase,
        phaseDurationMs,
        holdDurationMs: TRACKER_CONFIG.shoulderPress.holdDurationMs,
        completedReps: nextState.repCount,
        issues: [
          {
            active: rangeOfMotion < 65,
            message: 'Press higher',
            priority: 1,
          },
          {
            active: stabilityScore < 62,
            message: 'Keep your torso upright',
            priority: 2,
          },
          {
            active: symmetryScore < 62,
            message: 'Keep both sides even',
            priority: 3,
          },
          {
            active: nextState.phase === 'lowering' && eccentricSpeed > TRACKER_CONFIG.shoulderPress.loweringVelocityLimitNormalizedPerSec,
            message: 'Lower with control',
            priority: 4,
          },
          {
            active: controlScore < 60,
            message: 'Control the movement',
            priority: 5,
          },
        ],
      });

    nextState = {
      ...nextState,
      coachStatus: coachingDecision.status,
      lastFeedback: coachingDecision.message,
      lastFeedbackKey: coachingDecision.message,
      lastFeedbackTimestamp: frame.timestampMs,
    };

    return {
      nextState,
      coachStatus: coachingDecision.status,
      primaryFeedback: coachingDecision.message,
    };
  },
  buildSummary: (state, durationMs): ExerciseSummary => ({
    exercise: 'shoulder-press',
    totalReps: state.repCount,
    validReps: state.validRepCount,
    mostCommonMistake: getMostCommonMistake(state.mistakeCounts),
    scores: buildFinalScores(state.metrics),
    durationMs,
    completedAt: Date.now(),
  }),
};
