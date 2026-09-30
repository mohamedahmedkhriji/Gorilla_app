import { PROGRAM_ENGINE_VERSION } from '../config/engineConfig.js';
import { durationFits } from './durationModel.js';
import { calculateWeeklyVolumeSummary } from './volumeSummary.js';

const error = (field, code, message) => ({ field, code, message });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export class CompleteProgramValidationError extends Error {
  constructor(errors) {
    super(errors.map((entry) => entry.message).join('; '));
    this.name = 'CompleteProgramValidationError';
    this.errors = errors;
  }
}

const validateResistanceExercise = (exercise, path, errors) => {
  if (!Number.isInteger(exercise.exercise?.exerciseId) || exercise.exercise.exerciseId <= 0) {
    errors.push(error(`${path}.exercise.exerciseId`, 'invalid_exercise_id', 'Exercise must retain a stable canonical exercise ID.'));
  }
  if (!exercise.exercise?.slug) {
    errors.push(error(`${path}.exercise.slug`, 'missing_slug', 'Exercise must retain canonical slug.'));
  }
  if (!Number.isInteger(exercise.prescription?.sets) || exercise.prescription.sets < 1 || exercise.prescription.sets > 8) {
    errors.push(error(`${path}.prescription.sets`, 'invalid_sets', 'Sets must be 1..8.'));
  }
  const reps = exercise.prescription?.reps;
  if (!reps || reps.type !== 'range' || !Number.isInteger(reps.min) || !Number.isInteger(reps.max) || reps.min < 1 || reps.max < reps.min) {
    errors.push(error(`${path}.prescription.reps`, 'invalid_reps', 'Rep prescription must be a valid range.'));
  }
  const effort = exercise.prescription?.effort;
  if (!effort || effort.type !== 'rir' || !Number.isFinite(effort.target) || effort.target < 0 || effort.target > 5) {
    errors.push(error(`${path}.prescription.effort`, 'invalid_effort', 'Effort must be a valid RIR target.'));
  }
  if (!Number.isFinite(exercise.prescription?.restSeconds) || exercise.prescription.restSeconds < 0 || exercise.prescription.restSeconds > 600) {
    errors.push(error(`${path}.prescription.restSeconds`, 'invalid_rest', 'Rest must be 0..600 seconds.'));
  }
};

const validateCardio = (cardio, path, errors) => {
  if (!cardio) return;
  if (cardio.type !== 'cardio') {
    errors.push(error(`${path}.type`, 'invalid_cardio_type', 'Cardio prescription must have type cardio.'));
  }
  if (!Number.isFinite(cardio.durationMinutes) || cardio.durationMinutes < 5 || cardio.durationMinutes > 120) {
    errors.push(error(`${path}.durationMinutes`, 'invalid_cardio_duration', 'Cardio duration must be 5..120 minutes.'));
  }
  if (!cardio.intensity?.type) {
    errors.push(error(`${path}.intensity`, 'missing_cardio_intensity', 'Cardio prescription needs intensity.'));
  }
};

const validatePowerliftingExposure = (program, errors) => {
  if (program.goal !== 'powerlifting') return;
  const patterns = new Set(program.weeks[0]?.days.flatMap((day) => (day.exercises || []).map((exercise) => exercise.slot.movementPattern)) ?? []);
  ['squat_pattern', 'bench', 'deadlift'].forEach((pattern) => {
    if (!patterns.has(pattern)) errors.push(error('weeks[0]', 'missing_powerlifting_exposure', `Missing ${pattern} exposure.`));
  });
};

const validateEnduranceSpacing = (program, errors) => {
  if (program.goal !== 'endurance') return;
  program.weeks.forEach((week, weekIndex) => {
    const hardDays = week.days
      .filter((day) => day.cardioPrescription && ['controlled_tempo', 'structured_intervals'].includes(day.cardioPrescription.sessionPurpose))
      .map((day) => day.dayOfWeek);
    hardDays.forEach((day, index) => {
      const next = hardDays[index + 1];
      if (next != null && next - day <= 1) {
        errors.push(error(`weeks[${weekIndex}]`, 'stacked_hard_endurance', 'Endurance hard sessions must not be consecutive.'));
      }
    });
  });
};

const validateWeeklyVolume = (program, errors) => {
  if (['fat_loss', 'endurance'].includes(program.goal)) return;
  const firstWeek = program.weeks?.[0];
  if (!firstWeek) return;
  const volume = calculateWeeklyVolumeSummary(firstWeek);
  Object.entries(volume).forEach(([muscle, sets]) => {
    if (sets > 30) {
      errors.push(error('volumeSummary', 'weekly_volume_too_high', `${muscle} direct weekly sets are implausibly high.`));
    }
  });

  const requiredMuscles = program.goal === 'powerlifting'
    ? ['chest', 'quadriceps', 'hamstrings']
    : ['chest', 'back', 'quadriceps', 'hamstrings'];
  requiredMuscles.forEach((muscle) => {
    if ((volume[muscle] ?? 0) < 2) {
      errors.push(error('volumeSummary', 'weekly_volume_too_low', `${muscle} direct weekly sets are too low for this goal.`));
    }
  });
};

export const validateCompleteGeneratedProgram = (program) => {
  const errors = [];
  if (!isObject(program)) {
    return { valid: false, errors: [error('program', 'invalid_program', 'Program must be an object.')] };
  }

  if (program.engineVersion !== PROGRAM_ENGINE_VERSION) errors.push(error('engineVersion', 'invalid_engine_version', 'Invalid engine version.'));
  if (program.programLengthWeeks !== 8) errors.push(error('programLengthWeeks', 'invalid_length', 'Program must contain 8 weeks.'));
  if (!Array.isArray(program.weeks) || program.weeks.length !== 8) errors.push(error('weeks', 'invalid_weeks', 'Program must contain 8 weeks.'));
  if (!program.progressionPolicy?.rule) errors.push(error('progressionPolicy', 'missing_progression', 'Progression policy is required.'));

  (program.weeks || []).forEach((week, weekIndex) => {
    if (week.weekNumber !== weekIndex + 1) errors.push(error(`weeks[${weekIndex}].weekNumber`, 'invalid_week_number', 'Invalid week number.'));
    if (!Array.isArray(week.days) || week.days.length !== 7) {
      errors.push(error(`weeks[${weekIndex}].days`, 'invalid_days', 'Each week must contain 7 days.'));
      return;
    }
    const dayNumbers = new Set();
    let trainingDays = 0;
    week.days.forEach((day, dayIndex) => {
      const path = `weeks[${weekIndex}].days[${dayIndex}]`;
      if (dayNumbers.has(day.dayOfWeek)) errors.push(error(`${path}.dayOfWeek`, 'duplicate_day', 'Duplicate day.'));
      dayNumbers.add(day.dayOfWeek);
      if (day.type === 'training') {
        trainingDays += 1;
        if (!durationFits(day.estimatedDurationMinutes, program.sessionDurationMinutes)) {
          errors.push(error(`${path}.estimatedDurationMinutes`, 'duration_too_long', 'Session duration exceeds target tolerance.'));
        }
        const ids = new Set();
        (day.exercises || []).forEach((exercise, exerciseIndex) => {
          if (ids.has(exercise.exercise?.exerciseId)) errors.push(error(`${path}.exercises`, 'duplicate_exercise', 'Duplicate exercise in one session.'));
          ids.add(exercise.exercise?.exerciseId);
          validateResistanceExercise(exercise, `${path}.exercises[${exerciseIndex}]`, errors);
        });
        validateCardio(day.cardioPrescription, `${path}.cardioPrescription`, errors);
        if ((!day.exercises || day.exercises.length === 0) && !day.cardioPrescription) {
          errors.push(error(path, 'empty_training_day', 'Training day needs exercises or cardio prescription.'));
        }
      } else if (day.type !== 'rest') {
        errors.push(error(`${path}.type`, 'invalid_day_type', 'Invalid day type.'));
      }
    });
    if (trainingDays !== program.daysPerWeek) errors.push(error(`weeks[${weekIndex}].days`, 'training_frequency_mismatch', 'Training frequency mismatch.'));
  });

  validatePowerliftingExposure(program, errors);
  validateEnduranceSpacing(program, errors);
  validateWeeklyVolume(program, errors);

  return { valid: errors.length === 0, errors };
};

export const assertValidCompleteGeneratedProgram = (program) => {
  const result = validateCompleteGeneratedProgram(program);
  if (!result.valid) throw new CompleteProgramValidationError(result.errors);
  return result;
};
