import {
  PROGRAM_ENGINE_VERSION,
  SUPPORTED_BLUEPRINT_GOALS,
  SUPPORTED_SESSION_DURATIONS,
  SUPPORTED_SPLIT_IDS,
} from '../config/engineConfig.js';
import { isKnownSlot } from '../slots/slotVocabulary.js';

const buildError = (field, code, message) => ({ field, code, message });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export class ProgramBlueprintValidationError extends Error {
  constructor(errors) {
    super(errors.map((error) => error.message).join('; '));
    this.name = 'ProgramBlueprintValidationError';
    this.errors = errors;
  }
}

const validatePowerliftingExposure = (blueprint, errors) => {
  if (blueprint.profile?.goal !== 'powerlifting') return;
  const patterns = new Set(
    blueprint.weekTemplate
      .filter((day) => day.type === 'training')
      .flatMap((day) => day.slots.map((slot) => slot.movementPattern)),
  );

  ['squat_pattern', 'bench', 'deadlift'].forEach((pattern) => {
    if (!patterns.has(pattern)) {
      errors.push(buildError('weekTemplate', 'missing_powerlifting_pattern', `Powerlifting blueprint must include ${pattern}.`));
    }
  });
};

const validateEnduranceSpacing = (blueprint, errors) => {
  if (blueprint.profile?.goal !== 'endurance') return;
  const hardDays = blueprint.weekTemplate
    .filter((day) => day.type === 'training')
    .filter((day) => day.slots.some((slot) => ['tempo', 'interval'].includes(slot.movementPattern)))
    .map((day) => day.dayOfWeek);

  hardDays.forEach((day, index) => {
    const next = hardDays[index + 1];
    if (next != null && next - day <= 1) {
      errors.push(buildError('weekTemplate', 'stacked_hard_endurance', 'Endurance hard sessions must not be stacked on consecutive days.'));
    }
  });
};

export const validateProgramBlueprint = (blueprint) => {
  const errors = [];

  if (!isObject(blueprint)) {
    return {
      valid: false,
      errors: [buildError('blueprint', 'invalid_blueprint', 'Blueprint must be an object.')],
    };
  }

  if (blueprint.engineVersion !== PROGRAM_ENGINE_VERSION) {
    errors.push(buildError('engineVersion', 'invalid_engine_version', `Blueprint engineVersion must be ${PROGRAM_ENGINE_VERSION}.`));
  }

  if (blueprint.profile?.identity === 'hyrox' || blueprint.profile?.identity === 'boxing') {
    errors.push(buildError('profile.identity', 'bypassed_identity', 'HYROX and Boxing profiles cannot enter this blueprint generator.'));
  }

  if (!SUPPORTED_BLUEPRINT_GOALS.includes(blueprint.profile?.goal)) {
    errors.push(buildError('profile.goal', 'unsupported_goal', `Unsupported goal: ${blueprint.profile?.goal}`));
  }

  if (!Number.isInteger(blueprint.programLengthWeeks) || blueprint.programLengthWeeks < 1 || blueprint.programLengthWeeks > 52) {
    errors.push(buildError('programLengthWeeks', 'invalid_program_length', 'Program length must be 1..52 weeks.'));
  }

  if (!Number.isInteger(blueprint.daysPerWeek) || blueprint.daysPerWeek < 2 || blueprint.daysPerWeek > 6) {
    errors.push(buildError('daysPerWeek', 'invalid_days_per_week', 'Days per week must be 2..6.'));
  }

  if (!SUPPORTED_SESSION_DURATIONS.includes(blueprint.sessionDurationMinutes)) {
    errors.push(buildError('sessionDurationMinutes', 'invalid_duration', 'Session duration must be 30, 45, 60, or 90.'));
  }

  if (!SUPPORTED_SPLIT_IDS.includes(blueprint.split?.id)) {
    errors.push(buildError('split.id', 'unsupported_split', `Unsupported split: ${blueprint.split?.id}`));
  }

  if (!Array.isArray(blueprint.weekTemplate) || blueprint.weekTemplate.length !== 7) {
    errors.push(buildError('weekTemplate', 'invalid_week_length', 'Week template must contain exactly 7 days.'));
  } else {
    const dayNumbers = new Set();
    let trainingDays = 0;
    let restDays = 0;

    blueprint.weekTemplate.forEach((day, index) => {
      const path = `weekTemplate[${index}]`;
      if (!isObject(day)) {
        errors.push(buildError(path, 'invalid_day', 'Week day must be an object.'));
        return;
      }
      if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7) {
        errors.push(buildError(`${path}.dayOfWeek`, 'invalid_day_number', 'dayOfWeek must be 1..7.'));
      }
      if (dayNumbers.has(day.dayOfWeek)) {
        errors.push(buildError(`${path}.dayOfWeek`, 'duplicate_day_number', 'Duplicate dayOfWeek.'));
      }
      dayNumbers.add(day.dayOfWeek);

      if (day.type === 'training') {
        trainingDays += 1;
        if (!day.sessionType) errors.push(buildError(`${path}.sessionType`, 'missing_session_type', 'Training day needs a sessionType.'));
        if (day.targetDurationMinutes !== blueprint.sessionDurationMinutes) {
          errors.push(buildError(`${path}.targetDurationMinutes`, 'duration_mismatch', 'Training day duration must match blueprint duration.'));
        }
        if (!Array.isArray(day.slots) || day.slots.length === 0) {
          errors.push(buildError(`${path}.slots`, 'missing_slots', 'Training day needs slots.'));
        } else {
          day.slots.forEach((slot, slotIndex) => {
            if (!isKnownSlot(slot)) {
              errors.push(buildError(`${path}.slots[${slotIndex}]`, 'invalid_slot', 'Slot is outside the stable vocabulary.'));
            }
          });
          if (!day.slots.some((slot) => slot.required)) {
            errors.push(buildError(`${path}.slots`, 'missing_required_slot', 'Training day needs at least one required slot.'));
          }
        }
      } else if (day.type === 'rest') {
        restDays += 1;
      } else {
        errors.push(buildError(`${path}.type`, 'invalid_day_type', 'Day type must be training or rest.'));
      }
    });

    if (trainingDays !== blueprint.daysPerWeek) {
      errors.push(buildError('weekTemplate', 'training_day_count_mismatch', 'Training day count must equal daysPerWeek.'));
    }
    if (blueprint.daysPerWeek < 7 && restDays < 1) {
      errors.push(buildError('weekTemplate', 'missing_rest_day', 'At least one rest day is required.'));
    }
  }

  validatePowerliftingExposure(blueprint, errors);
  validateEnduranceSpacing(blueprint, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const assertValidProgramBlueprint = (blueprint) => {
  const result = validateProgramBlueprint(blueprint);
  if (!result.valid) throw new ProgramBlueprintValidationError(result.errors);
  return result;
};
