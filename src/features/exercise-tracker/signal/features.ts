import type {
  ExtractedFeatures,
  Landmark,
  LandmarkMap,
  LandmarkName,
} from './processFrame';

export const MIN_SCALE = 0.05;

const EMPTY_FEATURES: ExtractedFeatures = {
  elbowAngleLeft: 0,
  elbowAngleRight: 0,
  shoulderAngleLeft: 0,
  shoulderAngleRight: 0,
  wristHeightRatioLeft: 0,
  wristHeightRatioRight: 0,
  symmetryDiff: 0,
  torsoLean: 0,
  velocity: {
    wristLeft: 0,
    wristRight: 0,
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance = (left: Landmark | undefined, right: Landmark | undefined) => {
  if (!left || !right) {
    return null;
  }

  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
};

const average = (left: number | null, right: number | null) => {
  if (left === null && right === null) {
    return null;
  }

  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return (left + right) / 2;
};

const getAngleDegrees = (
  first: Landmark | undefined,
  middle: Landmark | undefined,
  last: Landmark | undefined,
) => {
  const sideA = distance(middle, last);
  const sideB = distance(first, last);
  const sideC = distance(first, middle);

  if (sideA === null || sideB === null || sideC === null || sideA === 0 || sideC === 0) {
    return 0;
  }

  const cosine = clamp(
    ((sideA * sideA) + (sideC * sideC) - (sideB * sideB)) / (2 * sideA * sideC),
    -1,
    1,
  );

  return (Math.acos(cosine) * 180) / Math.PI;
};

const getMidpointX = (
  first: Landmark | undefined,
  second: Landmark | undefined,
) => {
  if (!first && !second) {
    return null;
  }

  if (!first) {
    return second?.x ?? null;
  }

  if (!second) {
    return first.x;
  }

  return (first.x + second.x) / 2;
};

const getWristHeightRatio = (
  shoulder: Landmark | undefined,
  wrist: Landmark | undefined,
  scale: number,
) => {
  if (!shoulder || !wrist || !Number.isFinite(scale) || scale <= 0) {
    return 0;
  }

  return (shoulder.y - wrist.y) / scale;
};

export const getShoulderScale = (landmarks: LandmarkMap) => (
  distance(landmarks.leftShoulder, landmarks.rightShoulder) ?? 0
);

const getLandmark = (landmarks: LandmarkMap, name: LandmarkName) => landmarks[name];

export const extractFeatures = (
  landmarks: LandmarkMap,
  velocities: ExtractedFeatures['velocity'],
): ExtractedFeatures => {
  const scale = getShoulderScale(landmarks);
  if (scale < MIN_SCALE) {
    return {
      ...EMPTY_FEATURES,
      velocity: { ...velocities },
    };
  }

  const elbowAngleLeft = getAngleDegrees(
    getLandmark(landmarks, 'leftShoulder'),
    getLandmark(landmarks, 'leftElbow'),
    getLandmark(landmarks, 'leftWrist'),
  );
  const elbowAngleRight = getAngleDegrees(
    getLandmark(landmarks, 'rightShoulder'),
    getLandmark(landmarks, 'rightElbow'),
    getLandmark(landmarks, 'rightWrist'),
  );
  const shoulderAngleLeft = getAngleDegrees(
    getLandmark(landmarks, 'leftHip'),
    getLandmark(landmarks, 'leftShoulder'),
    getLandmark(landmarks, 'leftElbow'),
  );
  const shoulderAngleRight = getAngleDegrees(
    getLandmark(landmarks, 'rightHip'),
    getLandmark(landmarks, 'rightShoulder'),
    getLandmark(landmarks, 'rightElbow'),
  );
  const wristHeightRatioLeft = getWristHeightRatio(
    getLandmark(landmarks, 'leftShoulder'),
    getLandmark(landmarks, 'leftWrist'),
    scale,
  );
  const wristHeightRatioRight = getWristHeightRatio(
    getLandmark(landmarks, 'rightShoulder'),
    getLandmark(landmarks, 'rightWrist'),
    scale,
  );

  const midShoulderX = average(
    getLandmark(landmarks, 'leftShoulder')?.x ?? null,
    getLandmark(landmarks, 'rightShoulder')?.x ?? null,
  ) ?? getMidpointX(getLandmark(landmarks, 'leftShoulder'), getLandmark(landmarks, 'rightShoulder')) ?? 0;
  const midHipX = average(
    getLandmark(landmarks, 'leftHip')?.x ?? null,
    getLandmark(landmarks, 'rightHip')?.x ?? null,
  ) ?? getMidpointX(getLandmark(landmarks, 'leftHip'), getLandmark(landmarks, 'rightHip')) ?? 0;

  return {
    elbowAngleLeft,
    elbowAngleRight,
    shoulderAngleLeft,
    shoulderAngleRight,
    wristHeightRatioLeft,
    wristHeightRatioRight,
    symmetryDiff: Math.abs(elbowAngleLeft - elbowAngleRight),
    torsoLean: (midShoulderX - midHipX) / scale,
    velocity: { ...velocities },
  };
};

export const createEmptyFeatures = (): ExtractedFeatures => ({
  ...EMPTY_FEATURES,
  velocity: {
    wristLeft: 0,
    wristRight: 0,
  },
});
