import {
  normalizeTrainingProfile,
} from './normalizeProfile.js';

export const PROGRAM_ENGINE_SUPPORTED_GOALS = Object.freeze([
  'hypertrophy',
  'powerlifting',
  'cutting',
  'bulking',
  'fat_loss',
  'endurance',
]);

export const PROGRAM_ENGINE_SUPPORTED_EXPERIENCE_LEVELS = Object.freeze([
  'beginner',
  'intermediate',
  'advanced',
]);

export const PROGRAM_ENGINE_SUPPORTED_SESSION_DURATIONS = Object.freeze([
  30,
  45,
  60,
  90,
]);

const buildError = (field, code, message) => ({
  field,
  code,
  message,
});

const isIntegerInRange = (value, min, max) =>
  Number.isInteger(Number(value))
  && Number(value) >= min
  && Number(value) <= max;

export const validateTrainingProfile = (profileOrInput = {}) => {
  const profile = profileOrInput.engineTarget
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);

  if (profile.bypassReason) {
    return {
      valid: true,
      bypassed: true,
      bypassReason: profile.bypassReason,
      errors: [],
    };
  }

  const errors = [];

  if (profile.engineTarget !== 'program_engine') {
    errors.push(buildError(
      'identity',
      'unsupported_identity',
      'Only bodybuilding and cardio profiles are supported by this program engine phase.',
    ));
  }

  if (!profile.goal) {
    errors.push(buildError('goal', 'required', 'Goal is required.'));
  } else if (!PROGRAM_ENGINE_SUPPORTED_GOALS.includes(profile.goal)) {
    errors.push(buildError('goal', 'unsupported_goal', `Unsupported goal: ${profile.goal}`));
  }

  if (!profile.experience) {
    errors.push(buildError('experience', 'required', 'Experience is required.'));
  } else if (!PROGRAM_ENGINE_SUPPORTED_EXPERIENCE_LEVELS.includes(profile.experience)) {
    errors.push(buildError('experience', 'unsupported_experience', `Unsupported experience: ${profile.experience}`));
  }

  if (profile.daysPerWeek == null) {
    errors.push(buildError('daysPerWeek', 'required', 'Days per week is required.'));
  } else if (!isIntegerInRange(profile.daysPerWeek, 2, 6)) {
    errors.push(buildError('daysPerWeek', 'invalid_days_per_week', 'Days per week must be between 2 and 6.'));
  }

  if (profile.sessionDurationMinutes == null) {
    errors.push(buildError('sessionDurationMinutes', 'required', 'Session duration is required.'));
  } else if (!PROGRAM_ENGINE_SUPPORTED_SESSION_DURATIONS.includes(Number(profile.sessionDurationMinutes))) {
    errors.push(buildError(
      'sessionDurationMinutes',
      'invalid_session_duration',
      'Session duration must be one of 30, 45, 60, or 90 minutes.',
    ));
  }

  return {
    valid: errors.length === 0,
    bypassed: false,
    bypassReason: null,
    errors,
  };
};

export const assertValidTrainingProfile = (profileOrInput = {}) => {
  const result = validateTrainingProfile(profileOrInput);
  if (!result.valid) {
    const error = new Error(result.errors.map((entry) => entry.message).join('; '));
    error.name = 'TrainingProfileValidationError';
    error.errors = result.errors;
    throw error;
  }
  return result;
};

