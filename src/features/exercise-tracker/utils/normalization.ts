import { POSE_INDICES } from '../logic/constants';
import type { PoseLandmark } from '../types/tracking';
import { calculateDistance } from './geometry';
import { getLandmark } from './landmarks';

export const calculateShoulderWidth = (landmarks: PoseLandmark[]) => {
  const leftShoulder = getLandmark(landmarks, POSE_INDICES.leftShoulder);
  const rightShoulder = getLandmark(landmarks, POSE_INDICES.rightShoulder);
  return calculateDistance(leftShoulder, rightShoulder);
};

export const calculateTorsoSize = (landmarks: PoseLandmark[]) => {
  const leftShoulder = getLandmark(landmarks, POSE_INDICES.leftShoulder);
  const rightShoulder = getLandmark(landmarks, POSE_INDICES.rightShoulder);
  const leftHip = getLandmark(landmarks, POSE_INDICES.leftHip);
  const rightHip = getLandmark(landmarks, POSE_INDICES.rightHip);

  const leftTorso = calculateDistance(leftShoulder, leftHip);
  const rightTorso = calculateDistance(rightShoulder, rightHip);

  if (leftTorso && rightTorso) {
    return (leftTorso + rightTorso) / 2;
  }

  return leftTorso || rightTorso || null;
};

export const getBodyReferenceSize = (landmarks: PoseLandmark[]) =>
  calculateShoulderWidth(landmarks)
  || calculateTorsoSize(landmarks)
  || null;

export const normalizeDistance = (
  distance: number | null,
  landmarks: PoseLandmark[],
) => {
  const reference = getBodyReferenceSize(landmarks);
  if (!distance || !reference) return null;
  return distance / reference;
};

export const normalizeByReference = (
  value: number | null,
  reference: number | null,
) => {
  if (value === null || reference === null || reference <= 0) return null;
  return value / reference;
};
