import type { Landmark } from './processFrame';

export const MAX_VELOCITY = 5.0;
const MIN_DELTA_TIME_SECONDS = 1 / 240;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance3D = (left: Landmark, right: Landmark) => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
};

export const computeVelocity = (
  current: Landmark | undefined,
  previous: Landmark | undefined,
  deltaTimeMs: number,
  scale: number,
) => {
  if (!current || !previous || !Number.isFinite(scale) || scale <= 0) {
    return 0;
  }

  const deltaSeconds = Math.max(MIN_DELTA_TIME_SECONDS, deltaTimeMs / 1000);
  const normalizedDistance = distance3D(current, previous) / scale;
  const velocity = normalizedDistance / deltaSeconds;

  return clamp(velocity, 0, MAX_VELOCITY);
};
