import { readFile } from 'node:fs/promises';

import { parseCsvObjects } from './csvParser.js';
import { analyzeExerciseMatches } from './exerciseMatcher.js';
import {
  inferDaysPerWeek,
  normalizeEquipment,
  normalizeExternalGoal,
  normalizeExternalLevel,
  normalizeMatchKey,
  parseListField,
  parsePositiveInteger,
  parsePositiveNumber,
} from './normalizers.js';
import { buildReferencePrograms } from './referenceProgram.js';

const REQUIRED_SUMMARY_COLUMNS = [
  'title',
  'description',
  'level',
  'goal',
  'equipment',
  'program_length',
  'time_per_workout',
  'total_exercises',
  'created',
  'last_edit',
];

const SUPPORTED_GOALS = ['hypertrophy', 'powerlifting', 'cutting', 'bulking', 'fat_loss', 'endurance'];

const countBy = (items, getter) => {
  const counts = {};
  items.forEach((item) => {
    const key = getter(item) ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
};

const median = (values) => {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
};

const mode = (values) => {
  const counts = countBy(values, (value) => value);
  const [first] = Object.entries(counts);
  return first ? first[0] : null;
};

const findDuplicateKeys = (items, keyGetter) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
};

const parseSummaryRows = (summaryCsvContent) => {
  const parsed = parseCsvObjects(summaryCsvContent);
  const missingColumns = REQUIRED_SUMMARY_COLUMNS.filter((column) => !parsed.headers.includes(column));
  const rows = parsed.rows.map((item) => ({ ...item.record, rowNumber: item.rowNumber, malformed: item.malformed }));
  return { headers: parsed.headers, rows, missingColumns, malformedCsvRows: parsed.rows.filter((item) => item.malformed).length };
};

const buildGoalCoverage = (programs) => {
  return Object.fromEntries(SUPPORTED_GOALS.map((goal) => {
    const matching = programs.filter((program) => program.goal === goal);
    return [goal, {
      programs: matching.length,
      availableLevels: [...new Set(matching.map((program) => program.level).filter((level) => level !== 'unknown'))].sort(),
      commonDaysPerWeek: mode(matching.map((program) => program.inferredDaysPerWeek).filter(Boolean)) ?? 'NOT AVAILABLE',
      typicalProgramLength: median(matching.map((program) => program.programLengthWeeks).filter(Boolean)) ?? 'NOT AVAILABLE',
      typicalExercisesPerSession: 'NOT AVAILABLE',
      dataQualityConcerns: matching.length === 0
        ? ['No reliable summary labels for this goal in available CSV.']
        : ['Exercise-day structure is not present in available CSV.'],
    }];
  }));
};

export const analyzeProgramDataset = ({
  summaryCsvContent,
  exerciseCsvContent = null,
  canonicalExercises = [],
  source = 'fitness.project',
} = {}) => {
  if (!summaryCsvContent) {
    throw new Error('summaryCsvContent is required');
  }

  const summary = parseSummaryRows(summaryCsvContent);
  const detailed = exerciseCsvContent ? parseCsvObjects(exerciseCsvContent) : { headers: [], rows: [] };
  const detailedRows = detailed.rows.map((item) => ({ ...item.record, rowNumber: item.rowNumber, malformed: item.malformed }));
  const { programs, errors } = buildReferencePrograms(summary.rows, detailedRows, { source });
  const externalExerciseNames = detailedRows.map((row) => row.exercise_name ?? row.exercise ?? row.name).filter(Boolean);
  const matching = externalExerciseNames.length > 0
    ? analyzeExerciseMatches(externalExerciseNames, canonicalExercises)
    : {
      totalUniqueExternalExerciseNames: null,
      exact: null,
      normalized: null,
      ambiguous: null,
      unmapped: null,
      matchPercentage: null,
      unmappedNames: [],
      ambiguousNames: [],
      matches: [],
      unavailableReason: 'No detailed exercise CSV was available in the inspected repository.',
    };

  const duplicateRows = findDuplicateKeys(summary.rows, (row) => JSON.stringify(row));
  const duplicatePrograms = findDuplicateKeys(summary.rows, (row) => normalizeMatchKey(row.title));
  const missingValues = REQUIRED_SUMMARY_COLUMNS.reduce((acc, column) => {
    acc[column] = summary.rows.filter((row) => !String(row[column] ?? '').trim()).length;
    return acc;
  }, {});

  const normalizedSummaries = programs.map((program) => ({
    externalId: program.externalId,
    source: program.source,
    goal: program.goal,
    level: program.level,
    equipment: program.equipment,
    programLengthWeeks: program.programLengthWeeks,
    averageSessionMinutes: program.averageSessionMinutes,
    inferredDaysPerWeek: program.inferredDaysPerWeek,
    weeks: program.weeks,
  }));

  const structuralStats = {
    availableTrainingDaysPerWeek: countBy(programs.filter((program) => program.inferredDaysPerWeek), (program) => program.inferredDaysPerWeek),
    weeksPerProgramMedian: median(programs.map((program) => program.programLengthWeeks).filter(Boolean)) ?? 'NOT AVAILABLE',
    uniqueWorkoutDaysPerProgram: detailedRows.length ? 'AVAILABLE_IN_DETAIL_ANALYSIS' : 'NOT AVAILABLE',
    exercisesPerDay: detailedRows.length ? 'AVAILABLE_IN_DETAIL_ANALYSIS' : 'NOT AVAILABLE',
    setsPerExercise: detailedRows.length ? 'AVAILABLE_IN_DETAIL_ANALYSIS' : 'NOT AVAILABLE',
    repsPerExercise: detailedRows.length ? 'AVAILABLE_IN_DETAIL_ANALYSIS' : 'NOT AVAILABLE',
    intensityFormats: detailedRows.length ? countBy(detailedRows, (row) => row.intensity ?? row.load ?? row.weight ?? 'missing') : 'NOT AVAILABLE',
  };

  const goalLevelStats = {};
  SUPPORTED_GOALS.forEach((goal) => {
    ['beginner', 'intermediate', 'advanced', 'unknown'].forEach((level) => {
      const subset = programs.filter((program) => program.goal === goal && program.level === level);
      if (subset.length === 0) return;
      goalLevelStats[`${goal}:${level}`] = {
        programs: subset.length,
        medianProgramLength: median(subset.map((program) => program.programLengthWeeks).filter(Boolean)) ?? 'NOT AVAILABLE',
        commonTrainingFrequency: mode(subset.map((program) => program.inferredDaysPerWeek).filter(Boolean)) ?? 'NOT AVAILABLE',
        medianExercisesPerTrainingDay: 'NOT AVAILABLE',
        medianSetsPerExercise: 'NOT AVAILABLE',
        repRangeDistributions: 'NOT AVAILABLE',
        commonRestDayPatterns: 'NOT AVAILABLE',
      };
    });
  });

  return {
    datasetDiscovered: true,
    actualFiles: {
      summary: 'Data/program_summary.csv',
      detailedExerciseRows: exerciseCsvContent ? 'provided_by_cli' : 'NOT FOUND',
    },
    actualColumns: {
      summary: summary.headers,
      detailedExerciseRows: detailed.headers,
    },
    totals: {
      programs: programs.length,
      exerciseRows: detailedRows.length || 'NOT AVAILABLE',
      uniqueExercises: externalExerciseNames.length ? new Set(externalExerciseNames.map(normalizeMatchKey)).size : 'NOT AVAILABLE',
    },
    distributions: {
      programsByGoal: countBy(programs, (program) => program.goal),
      programsByLevel: countBy(programs, (program) => program.level),
      programsByEquipment: countBy(programs, (program) => program.equipment),
      programsByDuration: countBy(programs, (program) => program.programLengthWeeks ?? 'unknown'),
      originalGoalLabels: countBy(summary.rows.flatMap((row) => parseListField(row.goal)), (label) => label),
      originalLevelLabels: countBy(summary.rows.flatMap((row) => parseListField(row.level)), (label) => label),
      originalEquipment: countBy(summary.rows, (row) => row.equipment || 'missing'),
    },
    goalCoverage: buildGoalCoverage(programs),
    structuralStats,
    goalLevelStats,
    dataQuality: {
      missingSummaryColumns: summary.missingColumns,
      malformedSummaryRows: summary.malformedCsvRows,
      malformedDetailedRows: detailed.rows?.filter((row) => row.malformed).length ?? 0,
      malformedNormalizedRows: errors,
      missingValues,
      duplicateRows,
      duplicatePrograms,
      summaryRowsWithAbsurdValues: summary.rows.filter((row) => {
        const weeks = parsePositiveInteger(row.program_length, { max: 104 });
        const minutes = parsePositiveNumber(row.time_per_workout, { max: 360 });
        return !weeks || !minutes;
      }).length,
    },
    exerciseMatching: matching,
    normalizedReferencePrograms: normalizedSummaries,
  };
};

export const analyzeProgramDatasetFiles = async ({
  summaryCsvPath,
  exerciseCsvPath = null,
  canonicalExercises = [],
  source = 'fitness.project',
} = {}) => {
  if (!summaryCsvPath) throw new Error('summaryCsvPath is required');
  const summaryCsvContent = await readFile(summaryCsvPath, 'utf8');
  const exerciseCsvContent = exerciseCsvPath ? await readFile(exerciseCsvPath, 'utf8') : null;
  return analyzeProgramDataset({
    summaryCsvContent,
    exerciseCsvContent,
    canonicalExercises,
    source,
  });
};
