import type { CoachStatus } from '../coach/types';
import type { MovementPhase } from '../movement/types';
import type { ExerciseType } from '../movement/types';
import type { SetStatus, TrackingState, ExerciseName } from '../types/tracking';
import type { TrackerRuntimeSnapshot, TrackerRuntimeStatus } from '../runtime/TrackerRuntime';

export type TrackerSummaryView = {
  setNumber: number;
  reps: number;
  validReps: number;
  invalidReps: number;
  averageRom: number;
  averageSymmetry: number;
  averageStability: number;
  averageControl: number;
  overallScore: number;
  dominantIssue?: string;
  fatigueTrend?: string;
};

export type TrackerStatusView = {
  tone: CoachStatus;
  title: string;
  message: string;
};

export type TrackerUiViewModel = {
  trackerStatus: SetStatus;
  feedback: TrackerStatusView;
  repCount: number;
  setNumber: number;
  phaseLabel: string;
  summary: TrackerSummaryView | null;
  debug: {
    stablePhase?: string;
    rawPhase?: string;
    confidence?: number;
    repJustCompleted: boolean;
    fatigueDetected: boolean;
    coachCandidateCode?: string;
  };
};

const STATUS_LABELS: Record<CoachStatus, string> = {
  idle: 'Ready',
  warning: 'Adjust position',
  good: 'Good form',
  bad: 'Fix your form',
};

const PHASE_LABELS: Record<MovementPhase, string> = {
  idle: 'Idle',
  setup: 'Setup',
  ready: 'Ready',
  concentric: 'Lift',
  peak: 'Peak',
  eccentric: 'Lower',
  repComplete: 'Rep complete',
};

const RUNTIME_STATUS_TO_SET_STATUS: Record<TrackerRuntimeStatus, SetStatus> = {
  idle: 'idle',
  active: 'active',
  paused: 'paused',
  finished: 'finished',
};

const roundMetric = (value: number | undefined) => Math.round(value ?? 0);

export const mapExerciseNameToEngineType = (exercise: ExerciseName): ExerciseType => (
  exercise === 'lateral-raise' ? 'lateralRaise' : 'shoulderPress'
);

const mapPhaseLabel = (phase?: MovementPhase) => {
  if (!phase) {
    return 'Waiting';
  }

  return PHASE_LABELS[phase];
};

const buildSummary = (snapshot: TrackerRuntimeSnapshot): TrackerSummaryView | null => {
  const summary = snapshot.summary;
  const session = snapshot.session;

  if (!summary || !session) {
    return null;
  }

  return {
    setNumber: session.currentSet,
    reps: summary.repCount,
    validReps: summary.validRepCount,
    invalidReps: summary.invalidRepCount,
    averageRom: roundMetric(summary.average.rom),
    averageSymmetry: roundMetric(summary.average.symmetry),
    averageStability: roundMetric(summary.average.stability),
    averageControl: roundMetric(summary.average.control),
    overallScore: roundMetric(summary.average.overall),
    dominantIssue: summary.dominantIssue,
    fatigueTrend: summary.fatigueTrend?.reason,
  };
};

const buildFeedback = (
  snapshot: TrackerRuntimeSnapshot,
  trackingState: TrackingState,
): TrackerStatusView => {
  if (trackingState.status === 'camera-error' || trackingState.status === 'model-error') {
    return {
      tone: 'warning',
      title: 'Adjust position',
      message: trackingState.errorMessage || 'Tracker unavailable',
    };
  }

  if (trackingState.status === 'requesting-camera' || trackingState.status === 'loading-model') {
    return {
      tone: 'idle',
      title: 'Ready',
      message: trackingState.status === 'requesting-camera'
        ? 'Waiting for camera access'
        : 'Preparing tracker',
    };
  }

  if (snapshot.status === 'idle') {
    return {
      tone: 'idle',
      title: 'Ready',
      message: '',
    };
  }

  if (snapshot.status === 'paused') {
    return {
      tone: 'idle',
      title: 'Paused',
      message: '',
    };
  }

  if (snapshot.status === 'finished') {
    return {
      tone: 'idle',
      title: 'Set complete',
      message: '',
    };
  }

  if (!trackingState.hasPose) {
    return {
      tone: 'warning',
      title: 'Adjust position',
      message: 'Center your body in frame',
    };
  }

  if (trackingState.isLowConfidence) {
    return {
      tone: 'warning',
      title: 'Adjust position',
      message: 'Hold still',
    };
  }

  if (!trackingState.isCentered) {
    return {
      tone: 'warning',
      title: 'Adjust position',
      message: 'Center your body in frame',
    };
  }

  if (snapshot.coach?.activeInstruction && snapshot.coach.shouldDisplay) {
    return {
      tone: snapshot.coach.status,
      title: STATUS_LABELS[snapshot.coach.status],
      message: snapshot.coach.activeInstruction.message,
    };
  }

  return {
    tone: 'idle',
    title: STATUS_LABELS.idle,
    message: '',
  };
};

export const mapTrackerUi = (
  snapshot: TrackerRuntimeSnapshot,
  trackingState: TrackingState,
): TrackerUiViewModel => ({
  trackerStatus: RUNTIME_STATUS_TO_SET_STATUS[snapshot.status],
  feedback: buildFeedback(snapshot, trackingState),
  repCount: snapshot.movement?.repCount ?? 0,
  setNumber: snapshot.session?.currentSet ?? 1,
  phaseLabel: mapPhaseLabel(snapshot.movement?.stablePhase),
  summary: buildSummary(snapshot),
  debug: {
    stablePhase: snapshot.movement?.stablePhase,
    rawPhase: snapshot.movement?.debug.rawPhase,
    confidence: snapshot.signal?.confidence,
    repJustCompleted: snapshot.movement?.repJustCompleted ?? false,
    fatigueDetected: snapshot.session?.fatigue.detected ?? false,
    coachCandidateCode: snapshot.coach?.debug.topCandidateCode,
  },
});
