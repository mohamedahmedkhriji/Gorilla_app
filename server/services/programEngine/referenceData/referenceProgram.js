import {
  inferDaysPerWeek,
  normalizeEquipment,
  normalizeExerciseName,
  normalizeExternalGoal,
  normalizeExternalLevel,
  normalizeMatchKey,
  normalizeReferenceString,
  parseDayNumber,
  parseIntensity,
  parseListField,
  parsePositiveInteger,
  parsePositiveNumber,
  parseReps,
  parseSets,
  parseWeekNumber,
} from './normalizers.js';

const stableExternalId = (source, title) => `${source}:${normalizeMatchKey(title).replace(/\s+/g, '-') || 'untitled'}`;

export const normalizeSummaryRow = (row, { source = 'fitness.project/program_summary' } = {}) => {
  const title = normalizeReferenceString(row.title, { maxLength: 300 });
  const description = normalizeReferenceString(row.description, { maxLength: 5000 });
  const programLengthWeeks = parsePositiveInteger(row.program_length, { max: 104 });
  const averageSessionMinutes = parsePositiveNumber(row.time_per_workout, { max: 360 });
  const totalExercises = parsePositiveInteger(row.total_exercises, { max: 100000 });

  if (!title) {
    return { valid: false, reason: 'missing_title' };
  }

  return {
    valid: true,
    value: {
      externalId: stableExternalId(source, title),
      source,
      title,
      description,
      originalGoalLabels: parseListField(row.goal),
      goal: normalizeExternalGoal(row.goal),
      originalLevelLabels: parseListField(row.level),
      level: normalizeExternalLevel(row.level),
      equipment: normalizeEquipment(row.equipment),
      originalEquipment: normalizeReferenceString(row.equipment, { maxLength: 120 }),
      programLengthWeeks,
      averageSessionMinutes,
      totalExercises,
      inferredDaysPerWeek: inferDaysPerWeek(title),
      weeks: [],
      sourceMetadata: {
        created: normalizeReferenceString(row.created, { maxLength: 50 }),
        lastEdit: normalizeReferenceString(row.last_edit, { maxLength: 50 }),
      },
    },
  };
};

export const normalizeExerciseRow = (row) => {
  const originalName = normalizeExerciseName(row.exercise_name ?? row.exercise ?? row.name);
  const weekNumber = parseWeekNumber(row.week ?? row.week_number);
  const dayNumber = parseDayNumber(row.day ?? row.day_number ?? row.workout_day);

  if (!originalName) return { valid: false, reason: 'missing_exercise_name' };
  if (!weekNumber) return { valid: false, reason: 'invalid_week' };
  if (!dayNumber) return { valid: false, reason: 'invalid_day' };

  return {
    valid: true,
    value: {
      weekNumber,
      dayNumber,
      originalName,
      normalizedName: normalizeMatchKey(originalName),
      sets: parseSets(row.sets),
      reps: parseReps(row.reps),
      intensity: parseIntensity(row.intensity ?? row.load ?? row.weight),
    },
  };
};

export const buildReferencePrograms = (summaryRows, exerciseRows = [], options = {}) => {
  const programs = [];
  const errors = [];
  const byTitle = new Map();

  summaryRows.forEach((row, index) => {
    const result = normalizeSummaryRow(row, options);
    if (!result.valid) {
      errors.push({ rowNumber: row.rowNumber ?? index + 2, reason: result.reason });
      return;
    }
    programs.push(result.value);
    byTitle.set(normalizeMatchKey(result.value.title), result.value);
  });

  exerciseRows.forEach((row, index) => {
    const title = normalizeReferenceString(row.title ?? row.program_title, { maxLength: 300 });
    const program = byTitle.get(normalizeMatchKey(title));
    if (!program) {
      errors.push({ rowNumber: row.rowNumber ?? index + 2, reason: 'unknown_program_title' });
      return;
    }

    const result = normalizeExerciseRow(row);
    if (!result.valid) {
      errors.push({ rowNumber: row.rowNumber ?? index + 2, reason: result.reason });
      return;
    }

    let week = program.weeks.find((item) => item.weekNumber === result.value.weekNumber);
    if (!week) {
      week = { weekNumber: result.value.weekNumber, days: [] };
      program.weeks.push(week);
    }

    let day = week.days.find((item) => item.dayNumber === result.value.dayNumber);
    if (!day) {
      day = { dayNumber: result.value.dayNumber, exercises: [] };
      week.days.push(day);
    }

    day.exercises.push({
      originalName: result.value.originalName,
      normalizedName: result.value.normalizedName,
      sets: result.value.sets,
      reps: result.value.reps,
      intensity: result.value.intensity,
    });
  });

  programs.forEach((program) => {
    program.weeks.sort((left, right) => left.weekNumber - right.weekNumber);
    program.weeks.forEach((week) => week.days.sort((left, right) => left.dayNumber - right.dayNumber));
  });

  return { programs, errors };
};
