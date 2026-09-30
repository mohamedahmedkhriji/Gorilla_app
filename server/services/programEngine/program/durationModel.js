const TOLERANCE_MINUTES = 6;

export const estimateResistanceDurationMinutes = (exercises = []) => {
  const seconds = exercises.reduce((sum, exercise) => {
    const sets = Number(exercise.prescription?.sets || 0);
    const maxReps = Number(exercise.prescription?.reps?.max || exercise.prescription?.reps?.min || 10);
    const rest = Number(exercise.prescription?.restSeconds || 90);
    const executionSeconds = sets * Math.max(25, maxReps * 4);
    const restSeconds = Math.max(0, sets - 1) * rest;
    const transitionSeconds = 75;
    return sum + executionSeconds + restSeconds + transitionSeconds;
  }, 0);

  return Math.ceil(seconds / 60);
};

export const reduceToDuration = ({ exercises, targetDurationMinutes, requiredMovementPatterns = [] }) => {
  let current = [...exercises];
  const requiredPatterns = new Set(requiredMovementPatterns);

  const fits = () => estimateResistanceDurationMinutes(current) <= targetDurationMinutes + TOLERANCE_MINUTES;
  if (fits()) return current;

  current = current.filter((exercise) => exercise.slot.required || requiredPatterns.has(exercise.slot.movementPattern));
  if (fits()) return current;

  current = current.map((exercise) => {
    if (requiredPatterns.has(exercise.slot.movementPattern) || exercise.slot.role === 'primary_compound') return exercise;
    return {
      ...exercise,
      prescription: {
        ...exercise.prescription,
        sets: Math.max(1, Number(exercise.prescription.sets || 1) - 1),
      },
    };
  });

  return current;
};

export const estimateDayDurationMinutes = (day) => {
  if (day.type !== 'training') return 0;
  if (day.cardioPrescription && (!day.exercises || day.exercises.length === 0)) {
    return day.cardioPrescription.durationMinutes;
  }
  const resistance = estimateResistanceDurationMinutes(day.exercises || []);
  const cardio = day.cardioPrescription ? Math.ceil(day.cardioPrescription.durationMinutes * 0.75) : 0;
  return resistance + cardio;
};

export const durationFits = (estimated, target) => estimated <= target + TOLERANCE_MINUTES;
