import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type ExerciseName = 'lateral-raise' | 'shoulder-press';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

export type TrackingStatus =
  | 'idle'
  | 'requesting-camera'
  | 'loading-model'
  | 'ready'
  | 'tracking'
  | 'camera-error'
  | 'model-error';

export type SetStatus = 'idle' | 'active' | 'paused' | 'finished';

export type FeedbackLevel = 'info' | 'success' | 'warning' | 'error';
export type CoachStatus = 'idle' | 'warning' | 'good' | 'bad';

export interface PoseLandmark extends NormalizedLandmark {
  index: number;
}

export interface CameraState {
  status: CameraStatus;
  errorMessage: string | null;
  videoWidth: number;
  videoHeight: number;
  isMirrored: boolean;
}

export interface FeedbackMessage {
  status: CoachStatus;
  level: FeedbackLevel;
  title: string;
  message: string;
}

export interface ScoreAccumulator {
  total: number;
  count: number;
}

export interface ExerciseScores {
  rangeOfMotion: number;
  symmetry: number;
  stability: number;
  control: number;
  overall: number;
}

export interface ExerciseScoreAccumulators {
  rangeOfMotion: ScoreAccumulator;
  symmetry: ScoreAccumulator;
  stability: ScoreAccumulator;
  control: ScoreAccumulator;
}

export interface RepRecord {
  timestampMs: number;
  isValid: boolean;
  feedback: string;
}

export interface ActiveRepWindow {
  startedAt: number;
  bestRomScore: number;
  lowestSymmetryScore: number;
  lowestStabilityScore: number;
  lowestControlScore: number;
  topReached: boolean;
  oneSideDominant: boolean;
  peakConcentricSpeed: number;
  peakEccentricSpeed: number;
}

export interface ExerciseDebugMetrics {
  [key: string]: number | string | boolean | null;
}

export interface ExerciseEngineState {
  phase: string;
  phaseStartedAt: number | null;
  repCount: number;
  validRepCount: number;
  lastRepTimestamp: number | null;
  coachStatus: CoachStatus;
  lastFeedback: string;
  lastFeedbackKey: string | null;
  lastFeedbackTimestamp: number | null;
  metrics: ExerciseScoreAccumulators;
  mistakeCounts: Record<string, number>;
  debug: ExerciseDebugMetrics;
  activeRep: ActiveRepWindow | null;
  history: RepRecord[];
  lostFrameCount: number;
}

export interface ExerciseSummary {
  exercise: ExerciseName;
  totalReps: number;
  validReps: number;
  mostCommonMistake: string;
  scores: ExerciseScores;
  durationMs: number;
  completedAt: number;
}

export interface PoseTrackingFrame {
  landmarks: PoseLandmark[];
  timestampMs: number;
  visibleLandmarkCount: number;
  bodyScale: number | null;
  shoulderWidth: number | null;
  torsoSize: number | null;
  hasPose: boolean;
  isCentered: boolean;
  isLowConfidence: boolean;
}

export interface TrackingState {
  status: TrackingStatus;
  selectedExercise: ExerciseName | null;
  visibleLandmarkCount: number;
  bodyScale: number | null;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  hasPose: boolean;
  isModelReady: boolean;
  isCameraReady: boolean;
  isCentered: boolean;
  isLowConfidence: boolean;
  processingMode: 'GPU' | 'CPU' | null;
  errorMessage: string | null;
}

export interface ExerciseFrameAnalysis {
  nextState: ExerciseEngineState;
  coachStatus: CoachStatus;
  primaryFeedback: string;
}

export interface ExerciseLogicModule {
  exercise: ExerciseName;
  label: string;
  createInitialState(): ExerciseEngineState;
  analyzeFrame(
    frame: PoseTrackingFrame,
    state: ExerciseEngineState,
  ): ExerciseFrameAnalysis;
  buildSummary(state: ExerciseEngineState, durationMs: number): ExerciseSummary;
}

export interface ExerciseSessionView {
  status: SetStatus;
  phase: string;
  repCount: number;
  validRepCount: number;
  coachStatus: CoachStatus;
  primaryFeedback: string;
  debug: ExerciseDebugMetrics;
  scoresPreview: ExerciseScores;
  currentDurationMs: number;
  summary: ExerciseSummary | null;
  history: ExerciseSummary[];
}
