import type { PoseLandmark } from '../types/tracking';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const smoothLandmarks = (
  current: PoseLandmark[],
  previous: PoseLandmark[] | null,
  alpha: number,
) => {
  if (!previous || previous.length !== current.length) {
    return current.map((landmark) => ({ ...landmark }));
  }

  const blend = clamp(alpha, 0.01, 0.99);

  // Exponential smoothing keeps the overlay stable without introducing much lag.
  return current.map((landmark, index) => {
    const previousLandmark = previous[index];
    if (!previousLandmark) return { ...landmark };

    if (landmark.visibility < 0.05) {
      return {
        ...previousLandmark,
        visibility: Math.max(landmark.visibility, previousLandmark.visibility * 0.92),
      };
    }

    return {
      ...landmark,
      x: previousLandmark.x + ((landmark.x - previousLandmark.x) * blend),
      y: previousLandmark.y + ((landmark.y - previousLandmark.y) * blend),
      z: previousLandmark.z + ((landmark.z - previousLandmark.z) * blend),
      visibility:
        previousLandmark.visibility
        + ((landmark.visibility - previousLandmark.visibility) * blend),
    };
  });
};
