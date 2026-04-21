import type { FrameInput, Landmark, LandmarkMap, LandmarkName } from './processFrame';

export const MIN_VISIBILITY = 0.5;
export const MAX_POSITION_JUMP = 0.15;
export const MAX_UNRELIABLE_CRITICAL_RATIO = 0.5;

export const CRITICAL_JOINTS: LandmarkName[] = [
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
];

const distance3D = (left: Landmark, right: Landmark) => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
};

const cloneLandmark = (landmark: Landmark): Landmark => ({
  x: landmark.x,
  y: landmark.y,
  z: landmark.z,
  visibility: landmark.visibility,
});

const getVisibility = (landmark?: Landmark) => landmark?.visibility ?? 0;

export interface PlausibilityResult {
  landmarks: LandmarkMap;
  interpolatedJoints: string[];
  unreliableCriticalJointCount: number;
  criticalPresenceCount: number;
  confidenceVisibilityAverage: number;
  valid: boolean;
}

export interface PlausibilityInput {
  frame: FrameInput;
  previousLandmarks: LandmarkMap | null;
  expectedJoints: readonly LandmarkName[];
}

export const applyPlausibilityFilter = ({
  frame,
  previousLandmarks,
  expectedJoints,
}: PlausibilityInput): PlausibilityResult => {
  const filteredLandmarks: LandmarkMap = {};
  const interpolatedJoints: string[] = [];
  const allJointNames = new Set<string>([
    ...expectedJoints,
    ...Object.keys(frame.landmarks || {}),
    ...Object.keys(previousLandmarks || {}),
  ]);

  let unreliableCriticalJointCount = 0;
  let presentCriticalJointCount = 0;
  let visibilityTotal = 0;

  allJointNames.forEach((jointName) => {
    const current = frame.landmarks[jointName];
    const previous = previousLandmarks?.[jointName];
    const isCritical = CRITICAL_JOINTS.includes(jointName as LandmarkName);

    if (isCritical && current) {
      presentCriticalJointCount += 1;
      visibilityTotal += getVisibility(current);
    }

    const lowVisibility = !current || getVisibility(current) < MIN_VISIBILITY;
    const implausibleJump = Boolean(
      current
      && previous
      && distance3D(current, previous) > MAX_POSITION_JUMP
    );
    const isUnreliable = lowVisibility || implausibleJump;

    if (isCritical && isUnreliable) {
      unreliableCriticalJointCount += 1;
    }

    if (isUnreliable && previous) {
      filteredLandmarks[jointName] = cloneLandmark(previous);
      interpolatedJoints.push(jointName);
      return;
    }

    if (current) {
      filteredLandmarks[jointName] = cloneLandmark(current);
      return;
    }

    if (previous) {
      filteredLandmarks[jointName] = cloneLandmark(previous);
      interpolatedJoints.push(jointName);
    }
  });

  const confidenceVisibilityAverage = presentCriticalJointCount > 0
    ? visibilityTotal / presentCriticalJointCount
    : 0;
  const criticalJointCount = CRITICAL_JOINTS.length;
  const valid = (unreliableCriticalJointCount / criticalJointCount) <= MAX_UNRELIABLE_CRITICAL_RATIO;

  return {
    landmarks: filteredLandmarks,
    interpolatedJoints,
    unreliableCriticalJointCount,
    criticalPresenceCount: presentCriticalJointCount,
    confidenceVisibilityAverage,
    valid,
  };
};
