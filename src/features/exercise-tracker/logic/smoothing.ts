import type { PoseLandmark } from '../types/tracking';
import { smoothLandmarks as smoothPoseLandmarks } from '../utils/smoothing';

export const smoothLandmarks = (
  current: PoseLandmark[],
  previous: PoseLandmark[] | null,
  alpha: number,
) => smoothPoseLandmarks(current, previous, alpha);

