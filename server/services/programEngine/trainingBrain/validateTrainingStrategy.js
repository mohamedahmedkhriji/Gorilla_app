import {
  TRAINING_BRAIN_SUPPORTED_DAYS,
  TRAINING_BRAIN_SUPPORTED_EXPERIENCE_LEVELS,
  TRAINING_BRAIN_SUPPORTED_GOALS,
  TRAINING_BRAIN_SUPPORTED_SESSION_DURATIONS,
  TRAINING_BRAIN_SUPPORTED_VALUES,
  TRAINING_BRAIN_VERSION,
} from './config/brainConfig.js';
import {
  ALL_TRAINING_BRAIN_REASON_CODES,
  ALL_TRAINING_BRAIN_WARNING_CODES,
} from './explainability/reasonCodes.js';
import { getProgramEngineSplitById } from '../scheduling/splitSelector.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const error = (path, code, message) => ({ path, code, message });

const oneOf = (value, values) => values.includes(value);

const validateReasonList = (items, allowedCodes, path, errors) => {
  if (!Array.isArray(items)) {
    errors.push(error(path, 'required_array', `${path} must be an array.`));
    return;
  }

  items.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(error(`${path}[${index}]`, 'invalid_item', 'Reason entries must be objects.'));
      return;
    }
    if (!allowedCodes.includes(item.code)) {
      errors.push(error(`${path}[${index}].code`, 'unsupported_code', `Unsupported code: ${item.code}`));
    }
  });
};

export const validateTrainingStrategy = (strategy) => {
  const errors = [];

  if (!isObject(strategy)) {
    return {
      valid: false,
      errors: [error('strategy', 'invalid_strategy', 'TrainingStrategy must be an object.')],
    };
  }

  if (strategy.brainVersion !== TRAINING_BRAIN_VERSION) {
    errors.push(error('brainVersion', 'unsupported_version', `brainVersion must be ${TRAINING_BRAIN_VERSION}.`));
  }

  if (!oneOf(strategy.status, TRAINING_BRAIN_SUPPORTED_VALUES.status)) {
    errors.push(error('status', 'unsupported_status', `Unsupported status: ${strategy.status}`));
  }

  if (strategy.status === 'bypassed') {
    if (!['hyrox', 'boxing'].includes(strategy.bypassReason)) {
      errors.push(error('bypassReason', 'unsupported_bypass_reason', 'Bypass reason must be hyrox or boxing.'));
    }
    validateReasonList(strategy.reasons, ALL_TRAINING_BRAIN_REASON_CODES, 'reasons', errors);
    validateReasonList(strategy.warnings, ALL_TRAINING_BRAIN_WARNING_CODES, 'warnings', errors);
    return { valid: errors.length === 0, errors };
  }

  if (strategy.status === 'conflict') {
    if (!TRAINING_BRAIN_SUPPORTED_GOALS.includes(strategy.goal)) {
      errors.push(error('goal', 'unsupported_goal', `Unsupported goal: ${strategy.goal}`));
    }
    if (!isObject(strategy.schedule)) {
      errors.push(error('schedule', 'required_object', 'schedule is required.'));
    }
    if (!isObject(strategy.explainability) || !Array.isArray(strategy.explainability.rejectedCandidates)) {
      errors.push(error('explainability.rejectedCandidates', 'required_array', 'conflict strategies must include rejected candidates.'));
    }
    if (!isObject(strategy.quality) || !oneOf(strategy.quality.decisionConfidence, TRAINING_BRAIN_SUPPORTED_VALUES.decisionConfidence)) {
      errors.push(error('quality.decisionConfidence', 'unsupported_decision_confidence', 'decisionConfidence must be low, medium, or high.'));
    }
    validateReasonList(strategy.reasons, ALL_TRAINING_BRAIN_REASON_CODES, 'reasons', errors);
    validateReasonList(strategy.warnings, ALL_TRAINING_BRAIN_WARNING_CODES, 'warnings', errors);
    return { valid: errors.length === 0, errors };
  }

  if (!TRAINING_BRAIN_SUPPORTED_GOALS.includes(strategy.goal)) {
    errors.push(error('goal', 'unsupported_goal', `Unsupported goal: ${strategy.goal}`));
  }

  if (!TRAINING_BRAIN_SUPPORTED_EXPERIENCE_LEVELS.includes(strategy.experience)) {
    errors.push(error('experience', 'unsupported_experience', `Unsupported experience: ${strategy.experience}`));
  }

  if (!oneOf(strategy.sexProfile, TRAINING_BRAIN_SUPPORTED_VALUES.sexProfile)) {
    errors.push(error('sexProfile', 'unsupported_sex_profile', `Unsupported sex profile: ${strategy.sexProfile}`));
  }

  if (!isObject(strategy.schedule)) {
    errors.push(error('schedule', 'required_object', 'schedule is required.'));
  } else {
    if (!TRAINING_BRAIN_SUPPORTED_DAYS.includes(strategy.schedule.daysPerWeek)) {
      errors.push(error('schedule.daysPerWeek', 'invalid_days', 'daysPerWeek must be 2..6.'));
    }
    if (strategy.schedule.availableDaysPerWeek != null && !TRAINING_BRAIN_SUPPORTED_DAYS.includes(strategy.schedule.availableDaysPerWeek)) {
      errors.push(error('schedule.availableDaysPerWeek', 'invalid_available_days', 'availableDaysPerWeek must be 2..6.'));
    }
    if (strategy.schedule.prescribedDaysPerWeek != null && !TRAINING_BRAIN_SUPPORTED_DAYS.includes(strategy.schedule.prescribedDaysPerWeek)) {
      errors.push(error('schedule.prescribedDaysPerWeek', 'invalid_prescribed_days', 'prescribedDaysPerWeek must be 2..6.'));
    }
    if (
      strategy.schedule.availableDaysPerWeek != null
      && strategy.schedule.prescribedDaysPerWeek != null
      && strategy.schedule.prescribedDaysPerWeek > strategy.schedule.availableDaysPerWeek
    ) {
      errors.push(error('schedule.prescribedDaysPerWeek', 'prescribed_exceeds_available', 'prescribedDaysPerWeek must not exceed availableDaysPerWeek.'));
    }
    if (!TRAINING_BRAIN_SUPPORTED_SESSION_DURATIONS.includes(strategy.schedule.sessionDurationMinutes)) {
      errors.push(error('schedule.sessionDurationMinutes', 'invalid_duration', 'sessionDurationMinutes must be 30, 45, 60, or 90.'));
    }
  }

  if (!isObject(strategy.architecture)) {
    errors.push(error('architecture', 'required_object', 'architecture is required.'));
  } else {
    if (!getProgramEngineSplitById(strategy.architecture.splitStrategy)) {
      errors.push(error('architecture.splitStrategy', 'unsupported_split', `Unsupported split: ${strategy.architecture.splitStrategy}`));
    }
    if (strategy.architecture.selectedStrategy && strategy.architecture.selectedStrategy !== strategy.architecture.splitStrategy) {
      errors.push(error('architecture.selectedStrategy', 'strategy_mismatch', 'selectedStrategy must match splitStrategy for v1.1.'));
    }
    if (!oneOf(strategy.architecture.frequencyStrategy, TRAINING_BRAIN_SUPPORTED_VALUES.frequencyStrategy)) {
      errors.push(error('architecture.frequencyStrategy', 'unsupported_frequency', `Unsupported frequency: ${strategy.architecture.frequencyStrategy}`));
    }
    if (!Array.isArray(strategy.architecture.alternatives)) {
      errors.push(error('architecture.alternatives', 'required_array', 'architecture.alternatives must be an array.'));
    }
  }

  if (!isObject(strategy.workload)) {
    errors.push(error('workload', 'required_object', 'workload is required.'));
  } else {
    ['volumeStrategy', 'intensityStrategy', 'fatigueStrategy', 'durationCapacity'].forEach((field) => {
      if (!oneOf(strategy.workload[field], TRAINING_BRAIN_SUPPORTED_VALUES[field])) {
        errors.push(error(`workload.${field}`, 'unsupported_value', `Unsupported ${field}: ${strategy.workload[field]}`));
      }
    });
  }

  if (!isObject(strategy.exerciseStrategy)) {
    errors.push(error('exerciseStrategy', 'required_object', 'exerciseStrategy is required.'));
  } else {
    if (!oneOf(strategy.exerciseStrategy.complexity, TRAINING_BRAIN_SUPPORTED_VALUES.exerciseComplexity)) {
      errors.push(error('exerciseStrategy.complexity', 'unsupported_complexity', `Unsupported complexity: ${strategy.exerciseStrategy.complexity}`));
    }
    if (!oneOf(strategy.exerciseStrategy.compoundPriority, TRAINING_BRAIN_SUPPORTED_VALUES.compoundPriority)) {
      errors.push(error('exerciseStrategy.compoundPriority', 'unsupported_compound_priority', `Unsupported compound priority: ${strategy.exerciseStrategy.compoundPriority}`));
    }
    if (!oneOf(strategy.exerciseStrategy.isolationPriority, TRAINING_BRAIN_SUPPORTED_VALUES.isolationPriority)) {
      errors.push(error('exerciseStrategy.isolationPriority', 'unsupported_isolation_priority', `Unsupported isolation priority: ${strategy.exerciseStrategy.isolationPriority}`));
    }
  }

  if (!isObject(strategy.progressionStrategy)) {
    errors.push(error('progressionStrategy', 'required_object', 'progressionStrategy is required.'));
  } else {
    if (!oneOf(strategy.progressionStrategy.type, TRAINING_BRAIN_SUPPORTED_VALUES.progressionType)) {
      errors.push(error('progressionStrategy.type', 'unsupported_progression_type', `Unsupported progression type: ${strategy.progressionStrategy.type}`));
    }
    if (!oneOf(strategy.progressionStrategy.aggressiveness, TRAINING_BRAIN_SUPPORTED_VALUES.progressionAggressiveness)) {
      errors.push(error('progressionStrategy.aggressiveness', 'unsupported_aggressiveness', `Unsupported aggressiveness: ${strategy.progressionStrategy.aggressiveness}`));
    }
  }

  if (!isObject(strategy.constraints) || !Array.isArray(strategy.constraints.movementsToAvoid)) {
    errors.push(error('constraints', 'invalid_constraints', 'constraints.movementsToAvoid must be an array.'));
  }

  if (!Number.isFinite(strategy.confidence) || strategy.confidence < 0.6 || strategy.confidence > 1) {
    errors.push(error('confidence', 'invalid_confidence', 'confidence must be a deterministic number from 0.60 to 1.00.'));
  }

  if (!isObject(strategy.referenceEvidence)) {
    errors.push(error('referenceEvidence', 'required_object', 'referenceEvidence is required.'));
  } else if (!Number.isInteger(Number(strategy.referenceEvidence.matchedCount)) || Number(strategy.referenceEvidence.matchedCount) < 0) {
    errors.push(error('referenceEvidence.matchedCount', 'invalid_matched_count', 'matchedCount must be a non-negative integer.'));
  }

  if (!isObject(strategy.explainability)) {
    errors.push(error('explainability', 'required_object', 'explainability is required.'));
  } else {
    validateReasonList(strategy.explainability.reasons, ALL_TRAINING_BRAIN_REASON_CODES, 'explainability.reasons', errors);
    validateReasonList(strategy.explainability.warnings, ALL_TRAINING_BRAIN_WARNING_CODES, 'explainability.warnings', errors);
    if (!Array.isArray(strategy.explainability.rejectedCandidates)) {
      errors.push(error('explainability.rejectedCandidates', 'required_array', 'rejectedCandidates must be an array.'));
    }
  }

  if (!isObject(strategy.quality)) {
    errors.push(error('quality', 'required_object', 'quality is required.'));
  } else {
    if (!Number.isFinite(strategy.quality.profileCompleteness) || strategy.quality.profileCompleteness < 0.6 || strategy.quality.profileCompleteness > 1) {
      errors.push(error('quality.profileCompleteness', 'invalid_profile_completeness', 'profileCompleteness must be 0.60..1.00.'));
    }
    if (!oneOf(strategy.quality.decisionConfidence, TRAINING_BRAIN_SUPPORTED_VALUES.decisionConfidence)) {
      errors.push(error('quality.decisionConfidence', 'unsupported_decision_confidence', 'decisionConfidence must be low, medium, or high.'));
    }
  }

  validateReasonList(strategy.reasons, ALL_TRAINING_BRAIN_REASON_CODES, 'reasons', errors);
  validateReasonList(strategy.warnings, ALL_TRAINING_BRAIN_WARNING_CODES, 'warnings', errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

export class TrainingStrategyValidationError extends Error {
  constructor(errors) {
    super(errors.map((entry) => entry.message).join('; '));
    this.name = 'TrainingStrategyValidationError';
    this.errors = errors;
  }
}

export const assertValidTrainingStrategy = (strategy) => {
  const result = validateTrainingStrategy(strategy);
  if (!result.valid) {
    throw new TrainingStrategyValidationError(result.errors);
  }
  return result;
};
