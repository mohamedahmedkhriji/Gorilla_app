import { TRAINING_BRAIN_WARNING_CODES, warning } from './reasonCodes.js';

const roundConfidence = (value) => Number(Math.max(0.6, Math.min(1, value)).toFixed(2));

const hasParsedEquipmentSignal = (constraints) =>
  constraints.requiredEquipment.length > 0 || constraints.excludedEquipment.length > 0;

const hasPowerliftingConflict = (goal, constraints) => {
  if (goal !== 'powerlifting') return false;
  const excluded = new Set(constraints.excludedMovementPatterns);
  return excluded.has('squat_pattern')
    || excluded.has('bench')
    || excluded.has('horizontal_press')
    || excluded.has('deadlift')
    || excluded.has('hip_hinge');
};

export const buildTrainingBrainConfidence = ({ profile, constraints }) => {
  const warnings = [];
  let confidence = 1;

  if (!profile.gender) {
    confidence -= 0.05;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.OPTIONAL_GENDER_MISSING));
  }

  if (!profile.trainingFocus) {
    confidence -= 0.05;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.OPTIONAL_TRAINING_FOCUS_MISSING));
  }

  if (!profile.recoveryStrategy) {
    confidence -= 0.05;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.OPTIONAL_RECOVERY_STRATEGY_MISSING));
  }

  if (!profile.equipmentNotes) {
    confidence -= 0.05;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.EQUIPMENT_INFORMATION_MISSING));
  } else if (!hasParsedEquipmentSignal(constraints)) {
    confidence -= 0.1;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.EQUIPMENT_INFORMATION_AMBIGUOUS, {
      equipmentNotes: profile.equipmentNotes,
    }));
  }

  if (hasPowerliftingConflict(profile.goal, constraints)) {
    confidence -= 0.25;
    warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.POWERLIFTING_CONSTRAINT_CONFLICT, {
      excludedMovementPatterns: constraints.excludedMovementPatterns,
    }));
  }

  return {
    confidence: roundConfidence(confidence),
    warnings,
  };
};

export const buildTrainingBrainQuality = ({
  profile,
  constraints,
  selectedCandidate = null,
  validCandidates = [],
}) => {
  const { confidence: profileCompleteness, warnings } = buildTrainingBrainConfidence({ profile, constraints });
  let decisionConfidence = 'low';

  if (selectedCandidate && validCandidates.length === 1) {
    decisionConfidence = 'high';
  } else if (selectedCandidate && validCandidates.length > 1) {
    const [first, second] = validCandidates;
    const gap = Number(first?.evaluation?.totalScore ?? 0) - Number(second?.evaluation?.totalScore ?? 0);
    decisionConfidence = gap >= 3 ? 'high' : gap >= 1 ? 'medium' : 'low';
  }

  return {
    profileCompleteness,
    decisionConfidence,
    confidence: profileCompleteness,
    warnings,
  };
};
