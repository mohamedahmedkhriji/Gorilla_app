import {
  AI_PLAN_PHASE_BLUEPRINT,
  AI_TRAINING_PLAN_DURATION_WEEKS,
} from '../ai/types.js';

const isObject = (value) =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value);

export const getPhaseForWeek = (weekNumber) =>
  AI_PLAN_PHASE_BLUEPRINT.find(
    ({ startWeek, endWeek }) =>
      weekNumber >= startWeek && weekNumber <= endWeek,
  ) || null;

export const validateRulesPlanDraft = (draft) => {
  const errors = [];

  if (!isObject(draft)) {
    return {
      valid: false,
      errors: ['draft must be an object'],
    };
  }

  if (
    typeof draft.planName !== 'string'
    || !draft.planName.trim()
  ) {
    errors.push('planName must be a non-empty string');
  }

  if (typeof draft.description !== 'string') {
    errors.push('description must be a string');
  }

  if (
    typeof draft.programType !== 'string'
    || !draft.programType.trim()
  ) {
    errors.push('programType must be a non-empty string');
  }

  if (
    typeof draft.goal !== 'string'
    || !draft.goal.trim()
  ) {
    errors.push('goal must be a non-empty string');
  }

  if (
    typeof draft.experienceLevel !== 'string'
    || !draft.experienceLevel.trim()
  ) {
    errors.push(
      'experienceLevel must be a non-empty string',
    );
  }

  if (
    draft.cycleWeeks
    !== AI_TRAINING_PLAN_DURATION_WEEKS
  ) {
    errors.push(
      `cycleWeeks must equal ${AI_TRAINING_PLAN_DURATION_WEEKS}`,
    );
  }

  if (
    !Array.isArray(draft.selectedDays)
    || draft.selectedDays.length === 0
  ) {
    errors.push('selectedDays must be a non-empty array');
  }

  if (
    Array.isArray(draft.selectedDays)
    && (
      !Number.isInteger(draft.daysPerWeek)
      || draft.daysPerWeek !== draft.selectedDays.length
    )
  ) {
    errors.push(
      'daysPerWeek must match selectedDays length',
    );
  }

  if (
    !Array.isArray(draft.weeks)
    || draft.weeks.length
      !== AI_TRAINING_PLAN_DURATION_WEEKS
  ) {
    errors.push(
      `weeks must contain ${AI_TRAINING_PLAN_DURATION_WEEKS} entries`,
    );
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  const selectedDaySet = new Set(draft.selectedDays);

  draft.weeks.forEach((week, weekIndex) => {
    const path = `weeks[${weekIndex}]`;
    const expectedWeekNumber = weekIndex + 1;

    if (!isObject(week)) {
      errors.push(`${path} must be an object`);
      return;
    }

    if (week.weekNumber !== expectedWeekNumber) {
      errors.push(
        `${path}.weekNumber must equal ${expectedWeekNumber}`,
      );
    }

    const expectedPhase =
      getPhaseForWeek(expectedWeekNumber);

    if (
      week.phaseName !== expectedPhase?.label
    ) {
      errors.push(
        `${path}.phaseName must equal ${expectedPhase?.label}`,
      );
    }

    if (!Array.isArray(week.workouts)) {
      errors.push(`${path}.workouts must be an array`);
      return;
    }

    if (
      week.workouts.length
      !== draft.selectedDays.length
    ) {
      errors.push(
        `${path}.workouts must match selectedDays`,
      );
    }

    const seenDays = new Set();

    week.workouts.forEach((workout, workoutIndex) => {
      const workoutPath =
        `${path}.workouts[${workoutIndex}]`;

      if (!isObject(workout)) {
        errors.push(`${workoutPath} must be an object`);
        return;
      }

      if (!selectedDaySet.has(workout.dayName)) {
        errors.push(
          `${workoutPath}.dayName is not selected`,
        );
      }

      if (seenDays.has(workout.dayName)) {
        errors.push(
          `${workoutPath}.dayName is duplicated`,
        );
      }

      seenDays.add(workout.dayName);

      if (
        typeof workout.workoutName !== 'string'
        || !workout.workoutName.trim()
      ) {
        errors.push(
          `${workoutPath}.workoutName is required`,
        );
      }

      if (
        !Number.isFinite(
          workout.estimatedDurationMinutes,
        )
        || workout.estimatedDurationMinutes < 20
        || workout.estimatedDurationMinutes > 180
      ) {
        errors.push(
          `${workoutPath}.estimatedDurationMinutes must be 20..180`,
        );
      }

      if (
        !Array.isArray(workout.exercises)
        || workout.exercises.length === 0
      ) {
        errors.push(
          `${workoutPath}.exercises must be non-empty`,
        );
        return;
      }

      workout.exercises.forEach(
        (exercise, exerciseIndex) => {
          const exercisePath =
            `${workoutPath}.exercises[${exerciseIndex}]`;

          if (!isObject(exercise)) {
            errors.push(
              `${exercisePath} must be an object`,
            );
            return;
          }

          if (
            typeof exercise.exerciseName !== 'string'
            || !exercise.exerciseName.trim()
          ) {
            errors.push(
              `${exercisePath}.exerciseName is required`,
            );
          }

          if (
            exercise.exerciseCatalogId != null
            && (
              !Number.isInteger(
                exercise.exerciseCatalogId,
              )
              || exercise.exerciseCatalogId <= 0
            )
          ) {
            errors.push(
              `${exercisePath}.exerciseCatalogId must be a positive integer`,
            );
          }

          if (
            !Number.isInteger(exercise.sets)
            || exercise.sets < 1
            || exercise.sets > 10
          ) {
            errors.push(
              `${exercisePath}.sets must be 1..10`,
            );
          }

          if (
            typeof exercise.reps !== 'string'
            || !exercise.reps.trim()
            || exercise.reps.length > 20
          ) {
            errors.push(
              `${exercisePath}.reps must be a non-empty string up to 20 characters`,
            );
          }

          if (
            !Number.isFinite(exercise.restSeconds)
            || exercise.restSeconds < 0
            || exercise.restSeconds > 600
          ) {
            errors.push(
              `${exercisePath}.restSeconds must be 0..600`,
            );
          }

          if (
            exercise.rpeTarget != null
            && (
              !Number.isFinite(exercise.rpeTarget)
              || exercise.rpeTarget < 5.5
              || exercise.rpeTarget > 10
            )
          ) {
            errors.push(
              `${exercisePath}.rpeTarget must be 5.5..10 or null`,
            );
          }

          if (
            exercise.targetWeight != null
            && (
              !Number.isFinite(exercise.targetWeight)
              || exercise.targetWeight < 0
              || exercise.targetWeight > 1000
            )
          ) {
            errors.push(
              `${exercisePath}.targetWeight must be 0..1000 or null`,
            );
          }

          if (
            !Array.isArray(exercise.targetMuscles)
            || exercise.targetMuscles.length === 0
            || exercise.targetMuscles.length > 3
          ) {
            errors.push(
              `${exercisePath}.targetMuscles must contain 1..3 muscles`,
            );
          }
        },
      );
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};
