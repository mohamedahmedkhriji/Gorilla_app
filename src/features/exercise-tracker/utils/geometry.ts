import type { PoseLandmark } from '../types/tracking';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const calculateDistance = (
  first: PoseLandmark | null | undefined,
  second: PoseLandmark | null | undefined,
  includeDepth = false,
) => {
  if (!first || !second) return null;

  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const dz = includeDepth ? first.z - second.z : 0;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
};

export const calculateAngle = (
  first: PoseLandmark | null | undefined,
  middle: PoseLandmark | null | undefined,
  last: PoseLandmark | null | undefined,
) => {
  if (!first || !middle || !last) return null;

  const vectorOne = {
    x: first.x - middle.x,
    y: first.y - middle.y,
    z: first.z - middle.z,
  };
  const vectorTwo = {
    x: last.x - middle.x,
    y: last.y - middle.y,
    z: last.z - middle.z,
  };

  const dotProduct =
    (vectorOne.x * vectorTwo.x)
    + (vectorOne.y * vectorTwo.y)
    + (vectorOne.z * vectorTwo.z);
  const magnitudeOne = Math.sqrt(
    (vectorOne.x * vectorOne.x)
    + (vectorOne.y * vectorOne.y)
    + (vectorOne.z * vectorOne.z),
  );
  const magnitudeTwo = Math.sqrt(
    (vectorTwo.x * vectorTwo.x)
    + (vectorTwo.y * vectorTwo.y)
    + (vectorTwo.z * vectorTwo.z),
  );

  if (!magnitudeOne || !magnitudeTwo) return null;

  const cosine = clamp(dotProduct / (magnitudeOne * magnitudeTwo), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
};

export const midpoint = (
  first: PoseLandmark | null | undefined,
  second: PoseLandmark | null | undefined,
): PoseLandmark | null => {
  if (!first || !second) return null;

  return {
    ...first,
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
    visibility: Math.min(first.visibility ?? 0, second.visibility ?? 0),
    index: -1,
  };
};

export const averageNumbers = (...values: Array<number | null | undefined>) => {
  const validValues = values.filter((value): value is number => typeof value === 'number');
  if (!validValues.length) return null;

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
};
