import type { PoseLandmark } from '../types/tracking';
import { smoothLandmarks as smoothPoseLandmarks } from '../utils/smoothing';
import { isLandmarkReliable } from '../utils/landmarks';
import { OneEuroFilter } from './oneEuroFilter';
import { TRACKER_CONFIG } from './trackerConfig';

const LOW_CONFIDENCE_RAW_BLEND = 0.15;

const cloneLandmark = (landmark: PoseLandmark): PoseLandmark => ({ ...landmark });

const findPreviousLandmark = (
  previous: PoseLandmark[] | null,
  index: number,
) => previous?.find((landmark) => landmark.index === index) ?? null;

export class LandmarkSmoother {
  private readonly filters = new Map<string, OneEuroFilter>();
  private readonly lastReliableLandmarks = new Map<number, PoseLandmark>();

  reset() {
    this.filters.forEach((filter) => filter.reset());
    this.filters.clear();
    this.lastReliableLandmarks.clear();
  }

  smooth(
    current: PoseLandmark[],
    timestampMs: number,
    previous: PoseLandmark[] | null = null,
  ) {
    return current.map((landmark) => {
      const reliable = isLandmarkReliable(
        landmark,
        TRACKER_CONFIG.general.minLandmarkVisibility,
      );
      const previousReliable = this.lastReliableLandmarks.get(landmark.index)
        ?? findPreviousLandmark(previous, landmark.index);
      const target = reliable || !previousReliable
        ? landmark
        : {
          ...landmark,
          x: previousReliable.x + ((landmark.x - previousReliable.x) * LOW_CONFIDENCE_RAW_BLEND),
          y: previousReliable.y + ((landmark.y - previousReliable.y) * LOW_CONFIDENCE_RAW_BLEND),
          z: previousReliable.z + ((landmark.z - previousReliable.z) * LOW_CONFIDENCE_RAW_BLEND),
        };

      const smoothed = {
        ...landmark,
        x: this.getFilter(landmark.index, 'x').filter(target.x, timestampMs),
        y: this.getFilter(landmark.index, 'y').filter(target.y, timestampMs),
        z: this.getFilter(landmark.index, 'z').filter(target.z, timestampMs),
        visibility: landmark.visibility,
      };

      if (reliable) {
        this.lastReliableLandmarks.set(landmark.index, cloneLandmark(smoothed));
      }

      return smoothed;
    });
  }

  private getFilter(index: number, axis: 'x' | 'y' | 'z') {
    const key = `${index}:${axis}`;
    const existing = this.filters.get(key);
    if (existing) {
      return existing;
    }

    const filter = new OneEuroFilter({
      minCutoff: TRACKER_CONFIG.general.landmarkFilterMinCutoff,
      beta: TRACKER_CONFIG.general.landmarkFilterBeta,
    });
    this.filters.set(key, filter);
    return filter;
  }
}

export const createLandmarkSmoother = () => new LandmarkSmoother();

export const smoothLandmarks = (
  current: PoseLandmark[],
  previous: PoseLandmark[] | null,
  alpha: number,
) => smoothPoseLandmarks(current, previous, alpha);
