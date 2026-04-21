import type { ExerciseName } from '../types/tracking';

export interface ExerciseOption {
  name: ExerciseName;
  label: string;
  subtitle: string;
  cameraTip: string;
}

export const EXERCISE_OPTIONS: ExerciseOption[] = [
  {
    name: 'lateral-raise',
    label: 'Lateral Raise',
    subtitle: 'Front-view shoulder isolation with symmetry, range, and control checks.',
    cameraTip: 'Stand facing the camera with both shoulders visible and enough room to lift arms to the side.',
  },
  {
    name: 'shoulder-press',
    label: 'Shoulder Press',
    subtitle: 'Front-view overhead pressing with lockout, alignment, and torso checks.',
    cameraTip: 'Face the camera and leave enough headroom so wrist lockout stays visible above your head.',
  },
];

export const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

export const MEDIAPIPE_VERSION = '0.10.34';
export const MEDIAPIPE_WASM_BASE_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_INDICES = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export const LANDMARK_SMOOTHING_ALPHA = 0.2;
export const UI_STATE_THROTTLE_MS = 100;

export const STATUS_LABELS = {
  idle: 'Idle',
  'requesting-camera': 'Requesting camera',
  'loading-model': 'Loading model',
  ready: 'Ready',
  tracking: 'Tracking',
  'camera-error': 'Camera error',
  'model-error': 'Model error',
} as const;

export const CAMERA_SETUP_GUIDANCE = [
  'Use a front-facing view for both supported exercises.',
  'Keep your full upper body in frame from hips to hands.',
  'Stand in even lighting so shoulders, elbows, and wrists stay visible.',
] as const;
