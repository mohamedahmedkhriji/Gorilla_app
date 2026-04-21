// Tuning lives here so movement thresholds can be adjusted without touching
// the UI or the pose pipeline.
export const TRACKER_CONFIG = {
  general: {
    // Confidence and framing gates used before exercise analysis runs.
    minLandmarkVisibility: 0.45,
    minReliableLandmarks: 12,
    centeredToleranceX: 0.18,
    bodyScaleTooFar: 0.09,
    bodyScaleTooClose: 0.4,
    // Run the expensive pose detector on a capped cadence instead of every paint.
    poseDetectionFps: 20,
    // Keep React commits on a slower cadence than the raw detector.
    uiCommitFps: 10,
    // Debounce rep completion so a shaky top or bottom position does not double-count.
    repCooldownMs: 900,
    // Hold the current exercise phase briefly when landmarks disappear.
    lostFrameGraceCount: 12,
    // Keep the live status stable by voting across the latest few frames.
    feedbackBufferSize: 7,
  },
  lateralRaise: {
    // Shoulder-angle thresholds for down -> lift -> top -> return transitions.
    liftStartAngleDeg: 28,
    topAngleDeg: 78,
    returnDownAngleDeg: 22,
    validTopAngleDeg: 84,
    // Normalized wrist-to-shoulder height gap. Lower is better at the top.
    wristShoulderHeightTolerance: 0.58,
    maxSymmetryDiffDeg: 16,
    validSymmetryDiffDeg: 12,
    maxTorsoLeanDeg: 14,
    validTorsoLeanDeg: 10,
    softBendMinDeg: 135,
    softBendMaxDeg: 178,
    loweringVelocityLimitDegPerSec: 145,
    motionDeadZoneDeg: 4,
    holdDurationMs: 500,
    minimumRepDurationMs: 850,
    maxOneSideLeadDeg: 24,
    minimumRomScore: 68,
  },
  shoulderPress: {
    // Wrist/shoulder and elbow thresholds for the rack position and lockout.
    pressStartOffsetTolerance: 0.7,
    topElbowExtensionDeg: 152,
    returnElbowBendDeg: 120,
    noseClearanceNormalized: 0.35,
    maxSymmetryDiffNormalized: 0.38,
    validSymmetryDiffNormalized: 0.24,
    maxTorsoDepthOffset: 1.15,
    validTorsoDepthOffset: 0.85,
    overheadAlignmentTolerance: 0.75,
    validOverheadAlignmentTolerance: 0.5,
    loweringVelocityLimitNormalizedPerSec: 2.9,
    motionDeadZoneNormalized: 0.018,
    holdDurationMs: 500,
    minimumRepDurationMs: 800,
    minimumRomScore: 68,
  },
} as const;
