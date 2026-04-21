import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { mapExerciseNameToEngineType, mapTrackerUi } from '../adapters/trackerUiMapper';
import type { TrackerUiViewModel } from '../adapters/trackerUiMapper';
import { POSE_INDICES, UI_STATE_THROTTLE_MS } from '../logic/constants';
import { TrackerRuntime } from '../runtime/TrackerRuntime';
import type { TrackerRuntimeSnapshot } from '../runtime/TrackerRuntime';
import type { FrameInput } from '../signal/processFrame';
import type { PoseTrackingFrame, ExerciseName, TrackingState } from '../types/tracking';
import { getLandmark } from '../utils/landmarks';

interface UseExerciseTrackerRuntimeArgs {
  selectedExercise: ExerciseName;
}

const INITIAL_RUNTIME_STATUS = 'idle' as const;

const landmarkKeys = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const;

const shallowEqualUi = (left: TrackerUiViewModel, right: TrackerUiViewModel) => (
  left.trackerStatus === right.trackerStatus
  && left.feedback.tone === right.feedback.tone
  && left.feedback.title === right.feedback.title
  && left.feedback.message === right.feedback.message
  && left.repCount === right.repCount
  && left.setNumber === right.setNumber
  && left.phaseLabel === right.phaseLabel
  && left.summary?.setNumber === right.summary?.setNumber
  && left.summary?.reps === right.summary?.reps
  && left.summary?.validReps === right.summary?.validReps
  && left.summary?.invalidReps === right.summary?.invalidReps
  && left.summary?.overallScore === right.summary?.overallScore
  && left.summary?.dominantIssue === right.summary?.dominantIssue
  && left.summary?.fatigueTrend === right.summary?.fatigueTrend
  && left.debug.stablePhase === right.debug.stablePhase
  && left.debug.rawPhase === right.debug.rawPhase
  && left.debug.confidence === right.debug.confidence
  && left.debug.repJustCompleted === right.debug.repJustCompleted
  && left.debug.fatigueDetected === right.debug.fatigueDetected
  && left.debug.coachCandidateCode === right.debug.coachCandidateCode
);

const buildEmptySnapshot = (selectedExercise: ExerciseName): TrackerRuntimeSnapshot => ({
  exercise: mapExerciseNameToEngineType(selectedExercise),
  status: INITIAL_RUNTIME_STATUS,
  signal: null,
  movement: null,
  session: null,
  coach: null,
  summary: null,
  startedAt: null,
  finishedAt: null,
});

const buildIdleTrackingState = (selectedExercise: ExerciseName): TrackingState => ({
  status: 'idle',
  selectedExercise,
  visibleLandmarkCount: 0,
  bodyScale: null,
  videoWidth: 0,
  videoHeight: 0,
  fps: 0,
  hasPose: false,
  isModelReady: false,
  isCameraReady: false,
  isCentered: true,
  isLowConfidence: true,
  processingMode: null,
  errorMessage: null,
});

const toSignalInput = (frame: PoseTrackingFrame): FrameInput => {
  const poseLandmarks = frame.landmarks;
  const landmarks: FrameInput['landmarks'] = {};

  landmarkKeys.forEach((key) => {
    const landmark = getLandmark(poseLandmarks, POSE_INDICES[key]);
    if (!landmark) {
      return;
    }

    landmarks[key] = {
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    };
  });

  return {
    landmarks,
    timestamp: frame.timestampMs,
  };
};

export function useExerciseTrackerRuntime({
  selectedExercise,
}: UseExerciseTrackerRuntimeArgs) {
  const [, startTransition] = useTransition();
  const runtimeRef = useRef<TrackerRuntime | null>(null);
  const trackingStateRef = useRef<TrackingState>(buildIdleTrackingState(selectedExercise));
  const snapshotRef = useRef<TrackerRuntimeSnapshot>(buildEmptySnapshot(selectedExercise));
  const publishedUiRef = useRef<TrackerUiViewModel>(
    mapTrackerUi(snapshotRef.current, trackingStateRef.current),
  );
  const lastPublishRef = useRef(0);
  const [ui, setUi] = useState<TrackerUiViewModel>(publishedUiRef.current);

  const publishUi = useCallback((force = false) => {
    const nextUi = mapTrackerUi(snapshotRef.current, trackingStateRef.current);
    const now = performance.now();

    if (
      !force
      && now - lastPublishRef.current < UI_STATE_THROTTLE_MS
      && shallowEqualUi(nextUi, publishedUiRef.current)
    ) {
      return;
    }

    if (!force && now - lastPublishRef.current < UI_STATE_THROTTLE_MS) {
      return;
    }

    lastPublishRef.current = now;

    if (shallowEqualUi(nextUi, publishedUiRef.current)) {
      return;
    }

    publishedUiRef.current = nextUi;
    startTransition(() => {
      setUi(nextUi);
    });
  }, [startTransition]);

  useEffect(() => {
    const runtime = new TrackerRuntime(mapExerciseNameToEngineType(selectedExercise));
    runtimeRef.current = runtime;
    trackingStateRef.current = buildIdleTrackingState(selectedExercise);
    snapshotRef.current = runtime.getSnapshot();
    publishedUiRef.current = mapTrackerUi(snapshotRef.current, trackingStateRef.current);
    setUi(publishedUiRef.current);
    lastPublishRef.current = 0;

    return () => {
      runtime.reset();
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
    };
  }, [selectedExercise]);

  const handlePoseFrame = useCallback((frame: PoseTrackingFrame) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    snapshotRef.current = runtime.processFrame(toSignalInput(frame));
    publishUi(false);
  }, [publishUi]);

  const start = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    snapshotRef.current = runtime.start();
    publishUi(true);
  }, [publishUi]);

  const pause = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    snapshotRef.current = runtime.pause();
    publishUi(true);
  }, [publishUi]);

  const reset = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    snapshotRef.current = runtime.reset();
    publishedUiRef.current = mapTrackerUi(snapshotRef.current, trackingStateRef.current);
    setUi(publishedUiRef.current);
    lastPublishRef.current = performance.now();
  }, []);

  const updateTrackingState = useCallback((trackingState: TrackingState) => {
    trackingStateRef.current = trackingState;
    publishUi(true);
  }, [publishUi]);

  const finish = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    snapshotRef.current = runtime.finishSet();
    publishUi(true);
  }, [publishUi]);

  return {
    ui,
    handlePoseFrame,
    updateTrackingState,
    start,
    pause,
    reset,
    finish,
  };
}
