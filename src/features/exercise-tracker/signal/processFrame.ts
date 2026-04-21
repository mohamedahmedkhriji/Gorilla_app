import { OneEuroFilter } from './OneEuroFilter';
import { createEmptyFeatures, extractFeatures, getShoulderScale, MIN_SCALE } from './features';
import { applyPlausibilityFilter, CRITICAL_JOINTS } from './plausibility';
import { computeVelocity } from './velocity';

export type LandmarkName =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle'
  | 'nose';

export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type LandmarkMap = {
  [key: string]: Landmark | undefined;
};

export type FrameInput = {
  landmarks: Record<string, Landmark>;
  timestamp: number;
};

export type ExtractedFeatures = {
  elbowAngleLeft: number;
  elbowAngleRight: number;
  shoulderAngleLeft: number;
  shoulderAngleRight: number;
  wristHeightRatioLeft: number;
  wristHeightRatioRight: number;
  symmetryDiff: number;
  torsoLean: number;
  velocity: {
    wristLeft: number;
    wristRight: number;
  };
};

export type ProcessedFrame = {
  valid: boolean;
  frameId: number;
  timestamp: number;
  landmarks: Record<string, Landmark>;
  interpolatedJoints: string[];
  features: ExtractedFeatures;
  rawFeatures: ExtractedFeatures;
  confidence: number;
};

const POSITION_FILTER_MIN_CUTOFF = 0.5;
const POSITION_FILTER_BETA = 0.003;
const POSITION_FILTER_D_CUTOFF = 1.0;

const FEATURE_FILTER_MIN_CUTOFF = 1.0;
const FEATURE_FILTER_BETA = 0.007;
const FEATURE_FILTER_D_CUTOFF = 1.0;

const HISTORY_LIMIT = 5;
const CONFIDENCE_INTERPOLATION_PENALTY = 0.1;
const FRAME_ID_START = 0;

const EXPECTED_LANDMARKS: LandmarkName[] = [
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'nose',
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const cloneLandmark = (landmark: Landmark): Landmark => ({
  x: landmark.x,
  y: landmark.y,
  z: landmark.z,
  visibility: landmark.visibility,
});

const toDefinedLandmarkRecord = (landmarks: LandmarkMap): Record<string, Landmark> => {
  const next: Record<string, Landmark> = {};

  Object.entries(landmarks).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    next[key] = cloneLandmark(value);
  });

  return next;
};

export class SignalProcessor {
  private frameId = FRAME_ID_START;
  private previousProcessedFrame: ProcessedFrame | null = null;
  private previousTimestampMs: number | null = null;
  private readonly history: ProcessedFrame[] = [];
  private readonly landmarkFilters = new Map<string, OneEuroFilter>();
  private readonly featureFilters = new Map<string, OneEuroFilter>();

  processFrame(input: FrameInput): ProcessedFrame {
    this.frameId += 1;

    const plausibility = applyPlausibilityFilter({
      frame: input,
      previousLandmarks: this.previousProcessedFrame?.landmarks ?? null,
      expectedJoints: EXPECTED_LANDMARKS,
    });

    const smoothedLandmarks = this.filterLandmarks(plausibility.landmarks, input.timestamp);
    const scale = getShoulderScale(smoothedLandmarks);
    const previousLandmarks = this.previousProcessedFrame?.landmarks;
    const timeDeltaMs = this.previousTimestampMs === null
      ? 0
      : Math.max(0, input.timestamp - this.previousTimestampMs);

    const rawVelocity = {
      wristLeft: computeVelocity(
        smoothedLandmarks.leftWrist,
        previousLandmarks?.leftWrist,
        timeDeltaMs,
        scale,
      ),
      wristRight: computeVelocity(
        smoothedLandmarks.rightWrist,
        previousLandmarks?.rightWrist,
        timeDeltaMs,
        scale,
      ),
    };

    const rawFeatures = scale >= MIN_SCALE
      ? extractFeatures(smoothedLandmarks, rawVelocity)
      : {
        ...createEmptyFeatures(),
        velocity: rawVelocity,
      };

    const valid = plausibility.valid && scale >= MIN_SCALE;
    const features = valid || !this.previousProcessedFrame
      ? this.filterFeatures(rawFeatures, input.timestamp)
      : this.cloneFeatures(this.previousProcessedFrame.features);

    const interpolatedCriticalCount = plausibility.interpolatedJoints
      .filter((joint) => CRITICAL_JOINTS.includes(joint as LandmarkName))
      .length;
    const confidence = clamp(
      plausibility.confidenceVisibilityAverage - (interpolatedCriticalCount * CONFIDENCE_INTERPOLATION_PENALTY),
      0,
      1,
    );

    const processedFrame: ProcessedFrame = {
      valid,
      frameId: this.frameId,
      timestamp: input.timestamp,
      landmarks: toDefinedLandmarkRecord(smoothedLandmarks),
      interpolatedJoints: [...plausibility.interpolatedJoints],
      features,
      rawFeatures: this.cloneFeatures(rawFeatures),
      confidence,
    };

    this.previousProcessedFrame = processedFrame;
    this.pushHistory(processedFrame);
    this.previousTimestampMs = input.timestamp;

    return processedFrame;
  }

  getHistory(): ProcessedFrame[] {
    return this.history.map((frame) => ({
      ...frame,
      landmarks: toDefinedLandmarkRecord(frame.landmarks),
      interpolatedJoints: [...frame.interpolatedJoints],
      features: this.cloneFeatures(frame.features),
      rawFeatures: this.cloneFeatures(frame.rawFeatures),
    }));
  }

  reset() {
    this.frameId = FRAME_ID_START;
    this.previousProcessedFrame = null;
    this.previousTimestampMs = null;
    this.history.length = 0;

    this.landmarkFilters.forEach((filter) => filter.reset());
    this.featureFilters.forEach((filter) => filter.reset());
  }

  private pushHistory(frame: ProcessedFrame) {
    this.history.push({
      ...frame,
      landmarks: toDefinedLandmarkRecord(frame.landmarks),
      interpolatedJoints: [...frame.interpolatedJoints],
      features: this.cloneFeatures(frame.features),
      rawFeatures: this.cloneFeatures(frame.rawFeatures),
    });

    while (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
  }

  private filterLandmarks(landmarks: LandmarkMap, timestamp: number): LandmarkMap {
    const nextLandmarks: LandmarkMap = {};

    Object.entries(landmarks).forEach(([jointName, landmark]) => {
      if (!landmark) {
        return;
      }

      nextLandmarks[jointName] = {
        x: this.getLandmarkFilter(`${jointName}:x`).filter(landmark.x, timestamp),
        y: this.getLandmarkFilter(`${jointName}:y`).filter(landmark.y, timestamp),
        z: this.getLandmarkFilter(`${jointName}:z`).filter(landmark.z, timestamp),
        visibility: landmark.visibility,
      };
    });

    return nextLandmarks;
  }

  private filterFeatures(features: ExtractedFeatures, timestamp: number): ExtractedFeatures {
    return {
      elbowAngleLeft: this.getFeatureFilter('elbowAngleLeft').filter(features.elbowAngleLeft, timestamp),
      elbowAngleRight: this.getFeatureFilter('elbowAngleRight').filter(features.elbowAngleRight, timestamp),
      shoulderAngleLeft: this.getFeatureFilter('shoulderAngleLeft').filter(features.shoulderAngleLeft, timestamp),
      shoulderAngleRight: this.getFeatureFilter('shoulderAngleRight').filter(features.shoulderAngleRight, timestamp),
      wristHeightRatioLeft: this.getFeatureFilter('wristHeightRatioLeft').filter(features.wristHeightRatioLeft, timestamp),
      wristHeightRatioRight: this.getFeatureFilter('wristHeightRatioRight').filter(features.wristHeightRatioRight, timestamp),
      symmetryDiff: this.getFeatureFilter('symmetryDiff').filter(features.symmetryDiff, timestamp),
      torsoLean: this.getFeatureFilter('torsoLean').filter(features.torsoLean, timestamp),
      velocity: {
        wristLeft: this.getFeatureFilter('velocity:wristLeft').filter(features.velocity.wristLeft, timestamp),
        wristRight: this.getFeatureFilter('velocity:wristRight').filter(features.velocity.wristRight, timestamp),
      },
    };
  }

  private getLandmarkFilter(key: string) {
    const existing = this.landmarkFilters.get(key);
    if (existing) {
      return existing;
    }

    const filter = new OneEuroFilter({
      minCutoff: POSITION_FILTER_MIN_CUTOFF,
      beta: POSITION_FILTER_BETA,
      dCutoff: POSITION_FILTER_D_CUTOFF,
    });
    this.landmarkFilters.set(key, filter);
    return filter;
  }

  private getFeatureFilter(key: string) {
    const existing = this.featureFilters.get(key);
    if (existing) {
      return existing;
    }

    const filter = new OneEuroFilter({
      minCutoff: FEATURE_FILTER_MIN_CUTOFF,
      beta: FEATURE_FILTER_BETA,
      dCutoff: FEATURE_FILTER_D_CUTOFF,
    });
    this.featureFilters.set(key, filter);
    return filter;
  }

  private cloneFeatures(features: ExtractedFeatures): ExtractedFeatures {
    return {
      ...features,
      velocity: {
        wristLeft: features.velocity.wristLeft,
        wristRight: features.velocity.wristRight,
      },
    };
  }
}

export const processor = new SignalProcessor();

export const processFrame = (input: FrameInput) => processor.processFrame(input);
