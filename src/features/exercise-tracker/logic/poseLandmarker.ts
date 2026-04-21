import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  MEDIAPIPE_WASM_BASE_URL,
  POSE_LANDMARKER_MODEL_URL,
} from './constants';

let filesetPromise: Promise<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>> | null = null;

const getVisionFileset = () => {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);
  }
  return filesetPromise;
};

const buildPoseLandmarker = async (delegate: 'GPU' | 'CPU') => {
  const vision = await getVisionFileset();

  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_LANDMARKER_MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
};

export const createPoseLandmarker = async () => {
  try {
    const landmarker = await buildPoseLandmarker('GPU');
    return { landmarker, processingMode: 'GPU' as const };
  } catch {
    const landmarker = await buildPoseLandmarker('CPU');
    return { landmarker, processingMode: 'CPU' as const };
  }
};
