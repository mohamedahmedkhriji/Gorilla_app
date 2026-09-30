const VOLUME_MUSCLES = Object.freeze([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]);

const normalizeVolumeMuscle = (value) => {
  const key = String(value || '').toLowerCase();
  if (key.includes('chest')) return 'chest';
  if (key.includes('back') || key.includes('lat') || key.includes('trap')) return 'back';
  if (key.includes('shoulder') || key.includes('delt')) return 'shoulders';
  if (key.includes('bicep')) return 'biceps';
  if (key.includes('tricep')) return 'triceps';
  if (key.includes('quad')) return 'quadriceps';
  if (key.includes('hamstring')) return 'hamstrings';
  if (key.includes('glute')) return 'glutes';
  if (key.includes('calf') || key.includes('calves')) return 'calves';
  if (key.includes('core') || key.includes('abs')) return 'core';
  return null;
};

export const emptyVolumeSummary = () => Object.fromEntries(VOLUME_MUSCLES.map((muscle) => [muscle, 0]));

export const calculateWeeklyVolumeSummary = (week) => {
  const summary = emptyVolumeSummary();
  week.days.forEach((day) => {
    (day.exercises || []).forEach((exercise) => {
      const muscle = normalizeVolumeMuscle(exercise.slot.primaryMuscleGroup) || normalizeVolumeMuscle(exercise.exercise.primaryMuscle);
      if (!muscle || !Object.hasOwn(summary, muscle)) return;
      summary[muscle] += Number(exercise.prescription.sets || 0);
    });
  });
  return summary;
};

export const calculateProgramVolumeSummary = (weeks = []) => {
  const firstTrainingWeek = weeks.find((week) => week.days?.some((day) => day.type === 'training'));
  return firstTrainingWeek ? calculateWeeklyVolumeSummary(firstTrainingWeek) : emptyVolumeSummary();
};
