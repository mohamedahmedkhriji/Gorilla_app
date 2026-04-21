import { POSE_INDICES } from '../constants';
import { createScoreAccumulators } from '../session';
import type {
  ExerciseEngineState,
  PoseTrackingFrame,
} from '../../types/tracking';
import { averageNumbers, midpoint } from '../../utils/geometry';
import { getLandmark } from '../../utils/landmarks';
import { normalizeByReference } from '../../utils/normalization';
import {
  calculateAngle,
  calculateSymmetry,
} from '../metrics';

export interface CoreBodyPoints {
  nose: ReturnType<typeof getLandmark>;
  leftShoulder: ReturnType<typeof getLandmark>;
  rightShoulder: ReturnType<typeof getLandmark>;
  leftElbow: ReturnType<typeof getLandmark>;
  rightElbow: ReturnType<typeof getLandmark>;
  leftWrist: ReturnType<typeof getLandmark>;
  rightWrist: ReturnType<typeof getLandmark>;
  leftHip: ReturnType<typeof getLandmark>;
  rightHip: ReturnType<typeof getLandmark>;
  shoulderCenter: ReturnType<typeof midpoint>;
  hipCenter: ReturnType<typeof midpoint>;
}

export const createInitialExerciseState = (
  phase: string,
  feedback: string,
): ExerciseEngineState => ({
  phase,
  phaseStartedAt: null,
  repCount: 0,
  validRepCount: 0,
  lastRepTimestamp: null,
  coachStatus: 'idle',
  lastFeedback: feedback,
  lastFeedbackKey: null,
  lastFeedbackTimestamp: null,
  metrics: createScoreAccumulators(),
  mistakeCounts: {},
  debug: {},
  activeRep: null,
  history: [],
  lostFrameCount: 0,
});

export const recordMistake = (
  current: Record<string, number>,
  mistake: string,
) => ({
  ...current,
  [mistake]: (current[mistake] || 0) + 1,
});

export const getCoreBodyPoints = (frame: PoseTrackingFrame): CoreBodyPoints => {
  const leftShoulder = getLandmark(frame.landmarks, POSE_INDICES.leftShoulder);
  const rightShoulder = getLandmark(frame.landmarks, POSE_INDICES.rightShoulder);
  const leftHip = getLandmark(frame.landmarks, POSE_INDICES.leftHip);
  const rightHip = getLandmark(frame.landmarks, POSE_INDICES.rightHip);

  return {
    nose: getLandmark(frame.landmarks, POSE_INDICES.nose),
    leftShoulder,
    rightShoulder,
    leftElbow: getLandmark(frame.landmarks, POSE_INDICES.leftElbow),
    rightElbow: getLandmark(frame.landmarks, POSE_INDICES.rightElbow),
    leftWrist: getLandmark(frame.landmarks, POSE_INDICES.leftWrist),
    rightWrist: getLandmark(frame.landmarks, POSE_INDICES.rightWrist),
    leftHip,
    rightHip,
    shoulderCenter: midpoint(leftShoulder, rightShoulder),
    hipCenter: midpoint(leftHip, rightHip),
  };
};

export const getTorsoLeanDegrees = (
  shoulderCenter: CoreBodyPoints['shoulderCenter'],
  hipCenter: CoreBodyPoints['hipCenter'],
) => {
  if (!shoulderCenter || !hipCenter) return null;

  const dx = shoulderCenter.x - hipCenter.x;
  const dy = hipCenter.y - shoulderCenter.y;
  if (!dy) return null;

  return Math.abs((Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI);
};

export const getCoreBodyValidity = (points: CoreBodyPoints) => Boolean(
  points.leftShoulder
  && points.rightShoulder
  && points.leftElbow
  && points.rightElbow
  && points.leftWrist
  && points.rightWrist
  && points.leftHip
  && points.rightHip,
);

export const getLateralRaiseMetrics = (frame: PoseTrackingFrame) => {
  const points = getCoreBodyPoints(frame);
  if (!getCoreBodyValidity(points)) {
    return null;
  }

  const leftRaiseAngle = calculateAngle(points.leftHip, points.leftShoulder, points.leftElbow);
  const rightRaiseAngle = calculateAngle(points.rightHip, points.rightShoulder, points.rightElbow);
  const averageRaiseAngle = averageNumbers(leftRaiseAngle, rightRaiseAngle);

  const leftElbowAngle = calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist);
  const rightElbowAngle = calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist);
  const averageElbowAngle = averageNumbers(leftElbowAngle, rightElbowAngle);

  const averageShoulderY = averageNumbers(points.leftShoulder?.y, points.rightShoulder?.y);
  const averageWristY = averageNumbers(points.leftWrist?.y, points.rightWrist?.y);
  const wristHeightGap = averageShoulderY !== null && averageWristY !== null
    ? Math.abs(averageWristY - averageShoulderY)
    : null;
  const wristHeightGapNormalized = normalizeByReference(
    wristHeightGap,
    frame.torsoSize || frame.shoulderWidth || frame.bodyScale,
  );

  return {
    points,
    leftRaiseAngle,
    rightRaiseAngle,
    averageRaiseAngle,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle,
    symmetryDiffDeg: calculateSymmetry(leftRaiseAngle, rightRaiseAngle),
    torsoLeanDeg: getTorsoLeanDegrees(points.shoulderCenter, points.hipCenter),
    wristHeightGapNormalized,
    torsoCenterX: averageNumbers(points.shoulderCenter?.x, points.hipCenter?.x),
  };
};

export const getShoulderPressMetrics = (frame: PoseTrackingFrame) => {
  const points = getCoreBodyPoints(frame);
  if (!getCoreBodyValidity(points) || !points.nose) {
    return null;
  }

  const reference = frame.torsoSize || frame.shoulderWidth || frame.bodyScale;
  const leftElbowAngle = calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist);
  const rightElbowAngle = calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist);
  const averageElbowAngle = averageNumbers(leftElbowAngle, rightElbowAngle);

  const leftShoulderOffset = normalizeByReference(
    Math.abs((points.leftWrist?.y ?? 0) - (points.leftShoulder?.y ?? 0)),
    reference,
  );
  const rightShoulderOffset = normalizeByReference(
    Math.abs((points.rightWrist?.y ?? 0) - (points.rightShoulder?.y ?? 0)),
    reference,
  );
  const averageStartOffsetNormalized = averageNumbers(leftShoulderOffset, rightShoulderOffset);

  const leftNoseClearance = normalizeByReference(
    (points.nose.y ?? 0) - (points.leftWrist?.y ?? 0),
    reference,
  );
  const rightNoseClearance = normalizeByReference(
    (points.nose.y ?? 0) - (points.rightWrist?.y ?? 0),
    reference,
  );
  const averageNoseClearanceNormalized = averageNumbers(leftNoseClearance, rightNoseClearance);

  const symmetryDiffNormalized = normalizeByReference(
    Math.abs((points.leftWrist?.y ?? 0) - (points.rightWrist?.y ?? 0)),
    reference,
  );
  const torsoDepthOffset = normalizeByReference(
    Math.abs((points.shoulderCenter?.z ?? 0) - (points.hipCenter?.z ?? 0)),
    reference,
  );
  const leftAlignment = normalizeByReference(
    Math.abs((points.leftWrist?.x ?? 0) - (points.leftShoulder?.x ?? 0)),
    frame.shoulderWidth || frame.bodyScale,
  );
  const rightAlignment = normalizeByReference(
    Math.abs((points.rightWrist?.x ?? 0) - (points.rightShoulder?.x ?? 0)),
    frame.shoulderWidth || frame.bodyScale,
  );
  const averageAlignmentNormalized = averageNumbers(leftAlignment, rightAlignment);

  return {
    points,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle,
    averageStartOffsetNormalized,
    averageNoseClearanceNormalized,
    symmetryDiffNormalized,
    torsoDepthOffset,
    averageAlignmentNormalized,
    torsoCenterX: averageNumbers(points.shoulderCenter?.x, points.hipCenter?.x),
  };
};

export const getTorsoDriftMetric = (
  torsoCenterX: number | null | undefined,
  previousTorsoCenterX: number | null,
  reference: number | null,
) => {
  if (torsoCenterX === null || torsoCenterX === undefined) return null;
  if (previousTorsoCenterX === null) return null;

  return normalizeByReference(
    Math.abs(torsoCenterX - previousTorsoCenterX),
    reference,
  );
};
