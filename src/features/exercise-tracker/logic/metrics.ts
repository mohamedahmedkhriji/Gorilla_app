import type { PoseLandmark } from '../types/tracking';
import {
  averageNumbers,
  calculateAngle as calculateRawAngle,
  calculateDistance as calculateRawDistance,
  midpoint,
} from '../utils/geometry';
import { normalizeByReference } from '../utils/normalization';

export interface CommonMotionMetrics {
  symmetry: number | null;
  torsoCenterMovement: number | null;
  speed: number;
}

export const calculateAngle = (
  first: PoseLandmark | null | undefined,
  middle: PoseLandmark | null | undefined,
  last: PoseLandmark | null | undefined,
) => calculateRawAngle(first, middle, last);

export const distance = (
  first: PoseLandmark | null | undefined,
  second: PoseLandmark | null | undefined,
  includeDepth = false,
) => calculateRawDistance(first, second, includeDepth);

export const normalize = (
  value: number | null,
  reference: number | null,
) => normalizeByReference(value, reference);

export const applyDeadZone = (
  delta: number | null,
  threshold: number,
) => {
  if (delta === null) return 0;
  return Math.abs(delta) < threshold ? 0 : delta;
};

export const calculateSymmetry = (
  leftValue: number | null,
  rightValue: number | null,
) => {
  if (leftValue === null || rightValue === null) return null;
  return Math.abs(leftValue - rightValue);
};

export const calculateTorsoCenterMovement = (
  leftShoulder: PoseLandmark | null | undefined,
  rightShoulder: PoseLandmark | null | undefined,
  leftHip: PoseLandmark | null | undefined,
  rightHip: PoseLandmark | null | undefined,
  previousTorsoCenterX: number | null,
  reference: number | null,
) => {
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const torsoCenter = shoulderCenter && hipCenter
    ? {
      x: averageNumbers(shoulderCenter.x, hipCenter.x) ?? 0,
    }
    : null;

  if (!torsoCenter || previousTorsoCenterX === null) {
    return null;
  }

  return normalize(Math.abs(torsoCenter.x - previousTorsoCenterX), reference);
};

export const calculateMovementSpeed = (
  currentValue: number | null,
  previousValue: number | null,
  elapsedSeconds: number | null,
  deadZoneThreshold = 0,
) => {
  if (currentValue === null || previousValue === null || !elapsedSeconds) {
    return 0;
  }

  const delta = applyDeadZone(currentValue - previousValue, deadZoneThreshold);

  return Math.abs(delta / Math.max(0.016, elapsedSeconds));
};
