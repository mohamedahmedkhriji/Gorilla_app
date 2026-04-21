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
  getLateralRaiseMetrics,
  getTorsoDriftMetric,
} from './shared';
import { clampScore, scoreFromLowerBound, scoreFromUpperBound } from '../scoring';

const LABEL = 'Lateral Raise';

const getDebugNumber = (value: unknown) => (typeof value === 'number' ? value : null);

export const lateralRaiseModule: ExerciseLogicModule = {
  exercise: 'lateral-raise',
  label: LABEL,
  createInitialState: () => createInitialExerciseState(
    'down',
    'Start position',
  ),
  analyzeFrame: (frame, state): ExerciseFrameAnalysis => {
    const metrics = getLateralRaiseMetrics(frame);

    if (!metrics || metrics.averageRaiseAngle === null) {
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

    const previousAngle = getDebugNumber(state.debug.previousAverageRaiseAngle);
    const previousTimestamp = getDebugNumber(state.debug.previousTimestampMs);
    const previousTorsoCenterX = getDebugNumber(state.debug.previousTorsoCenterX);
    const elapsedSeconds = previousTimestamp
      ? Math.max(0.016, (frame.timestampMs - previousTimestamp) / 1000)
      : null;
    const raiseAngleDelta = previousAngle !== null
      ? applyDeadZone(
        metrics.averageRaiseAngle - previousAngle,
        TRACKER_CONFIG.lateralRaise.motionDeadZoneDeg,
      )
      : 0;
    const averageRaiseVelocity = previousAngle !== null && elapsedSeconds
      ? raiseAngleDelta / elapsedSeconds
      : 0;
    const concentricSpeed = averageRaiseVelocity > 0 ? averageRaiseVelocity : 0;
    const eccentricSpeed = averageRaiseVelocity < 0 ? Math.abs(averageRaiseVelocity) : 0;
    const movementDirection = averageRaiseVelocity > 0
      ? 'up'
      : averageRaiseVelocity < 0
        ? 'down'
        : 'still';
    const torsoDrift = getTorsoDriftMetric(
      metrics.torsoCenterX,
      previousTorsoCenterX,
      frame.shoulderWidth || frame.torsoSize || frame.bodyScale,
    );

    const elbowDistanceFromSoftBend = metrics.averageElbowAngle === null
      ? null
      : Math.min(
        Math.abs(metrics.averageElbowAngle - TRACKER_CONFIG.lateralRaise.softBendMinDeg),
        Math.abs(metrics.averageElbowAngle - TRACKER_CONFIG.lateralRaise.softBendMaxDeg),
      );

    const heightScore = scoreFromUpperBound(
      metrics.wristHeightGapNormalized,
      TRACKER_CONFIG.lateralRaise.wristShoulderHeightTolerance * 0.28,
      TRACKER_CONFIG.lateralRaise.wristShoulderHeightTolerance * 1.15,
    );
    const shoulderAngleScore = scoreFromLowerBound(
      metrics.averageRaiseAngle,
      TRACKER_CONFIG.lateralRaise.validTopAngleDeg,
      TRACKER_CONFIG.lateralRaise.liftStartAngleDeg,
    );
    const rangeOfMotion = Math.max(heightScore, shoulderAngleScore);
    const symmetryScore = scoreFromUpperBound(
      metrics.symmetryDiffDeg,
      TRACKER_CONFIG.lateralRaise.validSymmetryDiffDeg,
      TRACKER_CONFIG.lateralRaise.maxSymmetryDiffDeg * 1.5,
    );
    const swayScore = scoreFromUpperBound(
      metrics.torsoLeanDeg,
      TRACKER_CONFIG.lateralRaise.validTorsoLeanDeg,
      TRACKER_CONFIG.lateralRaise.maxTorsoLeanDeg * 1.6,
    );
    const torsoDriftScore = scoreFromUpperBound(
      torsoDrift,
      0.04,
      0.12,
    );
    const stabilityScore = Math.min(swayScore, torsoDriftScore);
    const elbowQualityScore = elbowDistanceFromSoftBend === null
      ? 0
      : clampScore(100 - (elbowDistanceFromSoftBend * 2.6));
    const speedPenaltyScore = scoreFromUpperBound(
      Math.max(concentricSpeed, eccentricSpeed),
      TRACKER_CONFIG.lateralRaise.loweringVelocityLimitDegPerSec * 0.72,
      TRACKER_CONFIG.lateralRaise.loweringVelocityLimitDegPerSec * 1.5,
    );
    const controlScore = Math.min(speedPenaltyScore, elbowQualityScore);
    const oneSideDominant = Boolean(
      metrics.symmetryDiffDeg !== null
      && metrics.symmetryDiffDeg > TRACKER_CONFIG.lateralRaise.maxOneSideLeadDeg
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
        averageRaiseAngle: Number(metrics.averageRaiseAngle.toFixed(1)),
        averageRaiseVelocity: Number(averageRaiseVelocity.toFixed(1)),
        symmetryDiffDeg: metrics.symmetryDiffDeg !== null
          ? Number(metrics.symmetryDiffDeg.toFixed(1))
          : null,
        torsoLeanDeg: metrics.torsoLeanDeg !== null
          ? Number(metrics.torsoLeanDeg.toFixed(1))
          : null,
        torsoDrift: torsoDrift !== null ? Number(torsoDrift.toFixed(3)) : null,
        elbowAngleDeg: metrics.averageElbowAngle !== null
          ? Number(metrics.averageElbowAngle.toFixed(1))
          : null,
        movementDirection,
        phaseDurationMs: state.phaseStartedAt !== null
          ? Math.max(0, Math.round(frame.timestampMs - state.phaseStartedAt))
          : 0,
        wristHeightGapNormalized: metrics.wristHeightGapNormalized !== null
          ? Number(metrics.wristHeightGapNormalized.toFixed(3))
          : null,
        previousAverageRaiseAngle: metrics.averageRaiseAngle,
        previousTimestampMs: frame.timestampMs,
        previousTorsoCenterX: metrics.torsoCenterX ?? null,
      },
    };

    if (
      state.phase === 'down'
      && metrics.averageRaiseAngle >= TRACKER_CONFIG.lateralRaise.liftStartAngleDeg
    ) {
      nextState = transitionPhase(nextState, 'lifting', frame.timestampMs, {
        activeRep: beginRepWindow(frame.timestampMs),
      });
    }

    if (
      nextState.phase === 'lifting'
      && (
        metrics.averageRaiseAngle >= TRACKER_CONFIG.lateralRaise.topAngleDeg
        || (
          metrics.wristHeightGapNormalized !== null
          && metrics.wristHeightGapNormalized <= TRACKER_CONFIG.lateralRaise.wristShoulderHeightTolerance
        )
      )
    ) {
      nextState = transitionPhase(nextState, 'top', frame.timestampMs, {
        activeRep: nextState.activeRep
          ? {
            ...nextState.activeRep,
            topReached: true,
          }
          : beginRepWindow(frame.timestampMs),
      });
    }

    if (nextState.phase === 'top' && averageRaiseVelocity < -6) {
      nextState = transitionPhase(nextState, 'lowering', frame.timestampMs);
    }

    let repFeedbackOverride: string | null = null;
    let repStatusOverride: 'good' | 'bad' | null = null;

    if (
      nextState.phase !== 'down'
      && metrics.averageRaiseAngle <= TRACKER_CONFIG.lateralRaise.returnDownAngleDeg
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
        minimumRepDurationMs: TRACKER_CONFIG.lateralRaise.minimumRepDurationMs,
        minimumRomScore: TRACKER_CONFIG.lateralRaise.minimumRomScore,
      });
      const feedback = antiCheatResult.validRep ? 'Good form' : antiCheatResult.reason || 'Fix your form';

      nextState = finalizeRepState({
        state: nextState,
        timestampMs: frame.timestampMs,
        phase: 'down',
        repScores,
        isValid: antiCheatResult.validRep,
        feedback,
        feedbackKey: feedback,
      });

      repFeedbackOverride = feedback;
      repStatusOverride = antiCheatResult.validRep ? 'good' : 'bad';
    } else if (
      nextState.phase !== 'down'
      && metrics.averageRaiseAngle <= TRACKER_CONFIG.lateralRaise.returnDownAngleDeg
      && !canCountRep(state.lastRepTimestamp, frame.timestampMs)
    ) {
      nextState = transitionPhase(nextState, 'down', frame.timestampMs, {
        activeRep: null,
      });
    }

    if (
      nextState.phase === 'lifting'
      && metrics.averageRaiseAngle < TRACKER_CONFIG.lateralRaise.liftStartAngleDeg * 0.7
    ) {
      nextState = transitionPhase(nextState, 'down', frame.timestampMs, {
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
        exerciseType: 'lateral-raise',
        phase: nextState.phase,
        phaseDurationMs,
        holdDurationMs: TRACKER_CONFIG.lateralRaise.holdDurationMs,
        completedReps: nextState.repCount,
        issues: [
          {
            active: rangeOfMotion < 65,
            message: 'Raise your hands higher',
            priority: 1,
          },
          {
            active: symmetryScore < 62,
            message: 'Keep both arms even',
            priority: 2,
          },
          {
            active: stabilityScore < 62,
            message: 'Do not swing your torso',
            priority: 3,
          },
          {
            active: nextState.phase === 'lowering' && eccentricSpeed > TRACKER_CONFIG.lateralRaise.loweringVelocityLimitDegPerSec,
            message: 'Lower slowly',
            priority: 4,
          },
          {
            active: elbowQualityScore < 60,
            message: 'Keep a soft bend in your elbows',
            priority: 5,
          },
          {
            active: speedPenaltyScore < 60,
            message: 'Control the weights',
            priority: 6,
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
    exercise: 'lateral-raise',
    totalReps: state.repCount,
    validReps: state.validRepCount,
    mostCommonMistake: getMostCommonMistake(state.mistakeCounts),
    scores: buildFinalScores(state.metrics),
    durationMs,
    completedAt: Date.now(),
  }),
};
