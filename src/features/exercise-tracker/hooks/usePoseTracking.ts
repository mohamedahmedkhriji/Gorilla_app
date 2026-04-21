import { RefObject, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  LANDMARK_SMOOTHING_ALPHA,
  UI_STATE_THROTTLE_MS,
} from '../logic/constants';
import { createPoseLandmarker } from '../logic/poseLandmarker';
import { clearCanvas, drawPoseOverlay } from '../logic/poseRenderer';
import { TRACKER_CONFIG } from '../logic/trackerConfig';
import { useTrackingLoop } from './useTrackingLoop';
import type {
  CameraState,
  ExerciseName,
  PoseTrackingFrame,
  TrackingState,
} from '../types/tracking';
import { countVisibleLandmarks, getLandmark, isLandmarkReliable, toPoseLandmarks } from '../utils/landmarks';
import {
  calculateShoulderWidth,
  calculateTorsoSize,
  getBodyReferenceSize,
} from '../utils/normalization';
import { smoothLandmarks } from '../logic/smoothing';
import { midpoint } from '../utils/geometry';
import { POSE_INDICES } from '../logic/constants';

interface UsePoseTrackingArgs {
  enabled: boolean;
  selectedExercise: ExerciseName;
  cameraState: CameraState;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  onFrame?: (frame: PoseTrackingFrame) => void;
}

const createInitialTrackingState = (
  exercise: ExerciseName,
  cameraState?: CameraState,
): TrackingState => ({
  status: 'idle',
  selectedExercise: exercise,
  visibleLandmarkCount: 0,
  bodyScale: null,
  videoWidth: cameraState?.videoWidth ?? 0,
  videoHeight: cameraState?.videoHeight ?? 0,
  fps: 0,
  hasPose: false,
  isModelReady: false,
  isCameraReady: false,
  isCentered: true,
  isLowConfidence: true,
  processingMode: null,
  errorMessage: null,
});

const hasReliableUpperBody = (landmarks: ReturnType<typeof toPoseLandmarks>) => {
  const requiredIndices = [
    POSE_INDICES.leftShoulder,
    POSE_INDICES.rightShoulder,
    POSE_INDICES.leftElbow,
    POSE_INDICES.rightElbow,
    POSE_INDICES.leftWrist,
    POSE_INDICES.rightWrist,
    POSE_INDICES.leftHip,
    POSE_INDICES.rightHip,
  ];

  return requiredIndices.every((index) =>
    isLandmarkReliable(
      getLandmark(landmarks, index),
      TRACKER_CONFIG.general.minLandmarkVisibility,
    ));
};

const getIsCentered = (landmarks: ReturnType<typeof toPoseLandmarks>) => {
  const leftShoulder = getLandmark(landmarks, POSE_INDICES.leftShoulder);
  const rightShoulder = getLandmark(landmarks, POSE_INDICES.rightShoulder);
  const leftHip = getLandmark(landmarks, POSE_INDICES.leftHip);
  const rightHip = getLandmark(landmarks, POSE_INDICES.rightHip);

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const bodyCenterX = shoulderCenter && hipCenter
    ? (shoulderCenter.x + hipCenter.x) / 2
    : shoulderCenter?.x ?? hipCenter?.x ?? 0.5;

  return Math.abs(bodyCenterX - 0.5) <= TRACKER_CONFIG.general.centeredToleranceX;
};

const hasPriorityTrackingChange = (
  previous: TrackingState,
  next: TrackingState,
) => (
  previous.status !== next.status
  || previous.hasPose !== next.hasPose
  || previous.isLowConfidence !== next.isLowConfidence
  || previous.isCentered !== next.isCentered
  || previous.errorMessage !== next.errorMessage
  || previous.isCameraReady !== next.isCameraReady
  || previous.isModelReady !== next.isModelReady
);

export function usePoseTracking({
  enabled,
  selectedExercise,
  cameraState,
  videoRef,
  canvasRef,
  onFrame,
}: UsePoseTrackingArgs) {
  const [trackingState, setTrackingState] = useState<TrackingState>(
    createInitialTrackingState(selectedExercise, cameraState),
  );
  const [, startTransition] = useTransition();

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const landmarkerPromiseRef = useRef<Promise<void> | null>(null);
  const previousLandmarksRef = useRef<ReturnType<typeof toPoseLandmarks> | null>(null);
  const lastProcessedVideoTimeRef = useRef(-1);
  const lastUiCommitRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const processedFramesRef = useRef(0);
  const trackingStateRef = useRef<TrackingState>(createInitialTrackingState(selectedExercise, cameraState));
  const processingModeRef = useRef<'GPU' | 'CPU' | null>(null);
  const onFrameRef = useRef(onFrame);
  const destroyedRef = useRef(false);

  onFrameRef.current = onFrame;

  const commitUiState = useCallback((nextState: TrackingState, force = false) => {
    const now = performance.now();
    const previous = trackingStateRef.current;
    const priorityChange = hasPriorityTrackingChange(previous, nextState);

    if (
      !force
      && !priorityChange
      && now - lastUiCommitRef.current < UI_STATE_THROTTLE_MS
    ) {
      trackingStateRef.current = nextState;
      return;
    }

    lastUiCommitRef.current = now;
    trackingStateRef.current = nextState;

    startTransition(() => {
      if (!destroyedRef.current) {
        setTrackingState(nextState);
      }
    });
  }, [startTransition]);

  const resetTrackingRuntime = useCallback(() => {
    previousLandmarksRef.current = null;
    lastProcessedVideoTimeRef.current = -1;
    startedAtRef.current = null;
    processedFramesRef.current = 0;
    clearCanvas(canvasRef.current);
  }, [canvasRef]);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) {
      return;
    }

    if (!landmarkerPromiseRef.current) {
      landmarkerPromiseRef.current = createPoseLandmarker()
        .then((bundle) => {
          landmarkerRef.current = bundle.landmarker;
          processingModeRef.current = bundle.processingMode;
        })
        .catch((error) => {
          landmarkerPromiseRef.current = null;
          throw error;
        });
    }

    await landmarkerPromiseRef.current;
  }, []);

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      landmarkerPromiseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextState = {
      ...trackingStateRef.current,
      selectedExercise,
      videoWidth: cameraState.videoWidth,
      videoHeight: cameraState.videoHeight,
    };

    trackingStateRef.current = nextState;
    setTrackingState(nextState);
  }, [cameraState.videoHeight, cameraState.videoWidth, selectedExercise]);

  useEffect(() => {
    if (!enabled) {
      resetTrackingRuntime();
      const nextState = createInitialTrackingState(selectedExercise, cameraState);
      trackingStateRef.current = nextState;
      setTrackingState(nextState);
      return;
    }

    if (cameraState.status === 'error') {
      resetTrackingRuntime();
      const nextState: TrackingState = {
        ...createInitialTrackingState(selectedExercise, cameraState),
        status: 'camera-error',
        errorMessage: cameraState.errorMessage,
      };

      trackingStateRef.current = nextState;
      setTrackingState(nextState);
      return;
    }

    if (cameraState.status === 'requesting') {
      const nextState: TrackingState = {
        ...createInitialTrackingState(selectedExercise, cameraState),
        status: 'requesting-camera',
      };

      trackingStateRef.current = nextState;
      setTrackingState(nextState);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const isLandmarkerCached = Boolean(landmarkerRef.current);
      if (!isLandmarkerCached) {
        commitUiState({
          ...createInitialTrackingState(selectedExercise, cameraState),
          status: 'loading-model',
          isCameraReady: cameraState.status === 'ready',
          videoWidth: cameraState.videoWidth,
          videoHeight: cameraState.videoHeight,
        }, true);
      }

      try {
        await ensureLandmarker();

        if (cancelled || destroyedRef.current) {
          return;
        }

        commitUiState({
          ...createInitialTrackingState(selectedExercise, cameraState),
          status: cameraState.status === 'ready' ? 'ready' : 'idle',
          isCameraReady: cameraState.status === 'ready',
          isModelReady: true,
          isLowConfidence: true,
          processingMode: processingModeRef.current,
          videoWidth: cameraState.videoWidth,
          videoHeight: cameraState.videoHeight,
        }, true);
      } catch (error) {
        if (cancelled || destroyedRef.current) {
          return;
        }

        commitUiState({
          ...createInitialTrackingState(selectedExercise, cameraState),
          status: 'model-error',
          isCameraReady: cameraState.status === 'ready',
          errorMessage: error instanceof Error
            ? error.message
            : 'Unable to load the MediaPipe pose model.',
        }, true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    cameraState,
    commitUiState,
    enabled,
    ensureLandmarker,
    resetTrackingRuntime,
    selectedExercise,
  ]);

  const processVideoFrame = useCallback((timestampMs: number) => {
    if (!enabled || cameraState.status !== 'ready') {
      return;
    }

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const poseLandmarker = landmarkerRef.current;

    if (!videoElement || !canvasElement || !poseLandmarker) {
      return;
    }

    if (!canvasElement.clientWidth || !canvasElement.clientHeight) {
      return;
    }

    if (
      videoElement.readyState < HTMLMediaElement.HAVE_METADATA
      || videoElement.videoWidth <= 0
      || videoElement.videoHeight <= 0
    ) {
      commitUiState({
        ...trackingStateRef.current,
        status: 'ready',
        isCameraReady: true,
        isModelReady: Boolean(poseLandmarker),
        videoWidth: videoElement.videoWidth || cameraState.videoWidth,
        videoHeight: videoElement.videoHeight || cameraState.videoHeight,
      });
      return;
    }

    if (videoElement.currentTime === lastProcessedVideoTimeRef.current) {
      return;
    }

    lastProcessedVideoTimeRef.current = videoElement.currentTime;

    try {
      const result = poseLandmarker.detectForVideo(videoElement, timestampMs);
      const rawLandmarks = toPoseLandmarks(result.landmarks[0]);
      const smoothedLandmarks = smoothLandmarks(
        rawLandmarks,
        previousLandmarksRef.current,
        LANDMARK_SMOOTHING_ALPHA,
      );

      previousLandmarksRef.current = smoothedLandmarks;
      drawPoseOverlay(canvasElement, smoothedLandmarks);

      const visibleLandmarkCount = countVisibleLandmarks(
        smoothedLandmarks,
        TRACKER_CONFIG.general.minLandmarkVisibility,
      );
      const shoulderWidth = calculateShoulderWidth(smoothedLandmarks);
      const torsoSize = calculateTorsoSize(smoothedLandmarks);
      const bodyScale = getBodyReferenceSize(smoothedLandmarks);
      const hasPose = visibleLandmarkCount >= TRACKER_CONFIG.general.minReliableLandmarks;
      const hasReliableBody = hasPose && hasReliableUpperBody(smoothedLandmarks);
      const isCentered = hasReliableBody ? getIsCentered(smoothedLandmarks) : true;
      const isLowConfidence = !hasReliableBody;

      if (!startedAtRef.current) {
        startedAtRef.current = timestampMs;
      }

      processedFramesRef.current += 1;
      const elapsedMs = Math.max(1, timestampMs - startedAtRef.current);
      const fps = Number(((processedFramesRef.current * 1000) / elapsedMs).toFixed(1));

      const frame: PoseTrackingFrame = {
        landmarks: smoothedLandmarks,
        timestampMs,
        visibleLandmarkCount,
        bodyScale,
        shoulderWidth,
        torsoSize,
        hasPose,
        isCentered,
        isLowConfidence,
      };

      onFrameRef.current?.(frame);

      commitUiState({
        status: hasPose ? 'tracking' : 'ready',
        selectedExercise,
        visibleLandmarkCount,
        bodyScale,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        fps,
        hasPose,
        isModelReady: true,
        isCameraReady: true,
        isCentered,
        isLowConfidence,
        processingMode: processingModeRef.current,
        errorMessage: null,
      });
    } catch (error) {
      commitUiState({
        ...createInitialTrackingState(selectedExercise, cameraState),
        status: 'model-error',
        isCameraReady: true,
        errorMessage: error instanceof Error
          ? error.message
          : 'Pose detection failed for the current video frame.',
      }, true);
    }
  }, [cameraState, canvasRef, commitUiState, enabled, selectedExercise, videoRef]);

  useTrackingLoop({
    enabled: enabled && cameraState.status === 'ready' && trackingState.status !== 'model-error',
    onTick: processVideoFrame,
    targetFps: TRACKER_CONFIG.general.poseDetectionFps,
  });

  return {
    trackingState,
  };
}
