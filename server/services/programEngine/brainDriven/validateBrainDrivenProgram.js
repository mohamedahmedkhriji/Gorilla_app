import { validateCompleteGeneratedProgram } from '../program/validateCompleteProgram.js';

const error = (field, code, message) => ({ field, code, message });

const hasInvalidNumber = (value) => {
  if (typeof value === 'number') return Number.isNaN(value) || !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasInvalidNumber);
  if (value && typeof value === 'object') return Object.values(value).some(hasInvalidNumber);
  return value === undefined;
};

const resistanceExercises = (program) =>
  program.weeks.flatMap((week) => week.days)
    .flatMap((day) => day.exercises || []);

export const validateBrainDrivenProgram = ({
  program,
  trainingStrategy,
  engineInput,
} = {}) => {
  const base = validateCompleteGeneratedProgram(program);
  const errors = [...base.errors];

  if (program?.weeks?.length !== 8) {
    errors.push(error('program.weeks', 'missing_eight_weeks', 'Brain-driven program must contain exactly 8 weeks.'));
  }

  if (program?.daysPerWeek !== engineInput?.prescribedDaysPerWeek) {
    errors.push(error('program.daysPerWeek', 'prescribed_frequency_mismatch', 'Program must use prescribedDaysPerWeek.'));
  }

  if (program?.split?.id !== engineInput?.selectedSplitStrategy) {
    errors.push(error('program.split.id', 'selected_split_mismatch', 'Program split must match Training Brain selected strategy.'));
  }

  if (program?.goal !== trainingStrategy?.goal) {
    errors.push(error('program.goal', 'goal_mismatch', 'Program goal must match TrainingStrategy goal.'));
  }

  if (hasInvalidNumber(program)) {
    errors.push(error('program', 'invalid_number_or_undefined', 'Program must not contain NaN, Infinity, or undefined values.'));
  }

  resistanceExercises(program || {}).forEach((exercise, index) => {
    if (!Number.isInteger(exercise.exercise?.exerciseId) || !exercise.exercise?.slug) {
      errors.push(error(`resistanceExercises[${index}]`, 'invalid_canonical_exercise', 'Resistance exercise must have canonical exercise ID and slug.'));
    }
  });

  const weeklyTrainingCounts = (program?.weeks || []).map((week) =>
    week.days.filter((day) => day.type === 'training').length);
  weeklyTrainingCounts.forEach((count, index) => {
    if (count !== engineInput?.prescribedDaysPerWeek) {
      errors.push(error(`weeks[${index}].days`, 'weekly_frequency_mismatch', 'Each week must match prescribed frequency.'));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const assertValidBrainDrivenProgram = (payload) => {
  const result = validateBrainDrivenProgram(payload);
  if (!result.valid) {
    const err = new Error(result.errors.map((entry) => entry.message).join('; '));
    err.name = 'BrainDrivenProgramValidationError';
    err.errors = result.errors;
    throw err;
  }
  return result;
};

