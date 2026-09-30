import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCsvObjects } from './csvParser.js';
import { analyzeExerciseMatches } from './exerciseMatcher.js';
import {
  normalizeEquipment,
  normalizeExerciseName,
  normalizeExternalGoal,
  normalizeExternalLevel,
  normalizeMatchKey,
  parseDayNumber,
  parseIntensity,
  parseReps,
  parseSets,
  parseWeekNumber,
} from './normalizers.js';
import { analyzeProgramDataset } from './analyzeDataset.js';
import { buildReferencePrograms, normalizeExerciseRow } from './referenceProgram.js';

test('parses quoted CSV fields and neutralizes formula-like cells', () => {
  const parsed = parseCsvObjects('title,description\n"Plan, A","Line ""one"""\n=cmd,ok\n');

  assert.deepEqual(parsed.headers, ['title', 'description']);
  assert.equal(parsed.rows[0].record.title, 'Plan, A');
  assert.equal(parsed.rows[0].record.description, 'Line "one"');
  assert.equal(parsed.rows[1].record.title, "'=cmd");
});

test('normalizes goals conservatively', () => {
  assert.equal(normalizeExternalGoal("['Bodybuilding']"), 'hypertrophy');
  assert.equal(normalizeExternalGoal("['Muscle & Sculpting']"), 'hypertrophy');
  assert.equal(normalizeExternalGoal("['Powerlifting']"), 'powerlifting');
  assert.equal(normalizeExternalGoal("['Fat Loss']"), 'fat_loss');
  assert.equal(normalizeExternalGoal("['Endurance']"), 'endurance');
  assert.equal(normalizeExternalGoal("['Athletics']"), 'unknown');
});

test('normalizes levels and equipment', () => {
  assert.equal(normalizeExternalLevel("['Novice']"), 'beginner');
  assert.equal(normalizeExternalLevel("['Intermediate']"), 'intermediate');
  assert.equal(normalizeExternalLevel("['Advanced']"), 'advanced');
  assert.equal(normalizeExternalLevel('[]'), 'unknown');

  assert.equal(normalizeEquipment('Full Gym'), 'full_gym');
  assert.equal(normalizeEquipment('Dumbbell Only'), 'dumbbell_only');
  assert.equal(normalizeEquipment(''), 'unknown');
});

test('parses week and day safely', () => {
  assert.equal(parseWeekNumber('Week 12'), 12);
  assert.equal(parseDayNumber('Day 4'), 4);
  assert.equal(parseWeekNumber('Week 999'), null);
  assert.equal(parseDayNumber('Day 99'), null);
});

test('parses sets, reps, and intensity', () => {
  assert.deepEqual(parseSets('4'), { type: 'fixed', value: 4, raw: '4' });
  assert.deepEqual(parseSets('many'), { type: 'unknown', raw: 'many' });

  assert.deepEqual(parseReps('8'), { type: 'fixed', value: 8, raw: '8' });
  assert.deepEqual(parseReps('8-12'), { type: 'range', min: 8, max: 12, raw: '8-12' });
  assert.deepEqual(parseReps('AMRAP'), { type: 'special', value: 'amrap', raw: 'AMRAP' });
  assert.deepEqual(parseReps('Failure'), { type: 'special', value: 'failure', raw: 'Failure' });
  assert.deepEqual(parseReps('12-8'), { type: 'unknown', raw: '12-8' });

  assert.deepEqual(parseIntensity('75%'), { type: 'percent', value: 75, raw: '75%' });
  assert.deepEqual(parseIntensity('RPE 8.5'), { type: 'rpe', value: 8.5, raw: 'RPE 8.5' });
  assert.deepEqual(parseIntensity('heavy-ish'), { type: 'unknown', raw: 'heavy-ish' });
});

test('normalizes exercise names for matching while preserving display text', () => {
  assert.equal(normalizeExerciseName('  Barbell   Bench Press  '), 'Barbell Bench Press');
  assert.equal(normalizeMatchKey('Barbell-Bench   Press!'), 'barbell bench press');
});

test('matches exercises exactly, normalized, ambiguous, and unmapped', () => {
  const catalog = [
    { id: 1, name: 'Barbell Bench Press', slug: 'barbell-bench-press' },
    { id: 2, name: 'Incline Dumbbell Press', slug: 'incline-dumbbell-press' },
    { id: 3, name: 'Pull Up', slug: 'pull-up' },
    { id: 4, name: 'Pull-Up', slug: 'pull-up-alt' },
  ];

  const result = analyzeExerciseMatches([
    'Barbell Bench Press',
    'incline dumbbell press',
    'pull/up',
    'Made Up Raise',
  ], catalog);

  assert.equal(result.exact, 1);
  assert.equal(result.normalized, 1);
  assert.equal(result.ambiguous, 1);
  assert.equal(result.unmapped, 1);
  assert.deepEqual(result.unmappedNames, ['Made Up Raise']);
});

test('rejects malformed detailed rows without blocking valid summaries', () => {
  const summaries = [{
    title: 'Simple 4 Day Builder',
    description: 'A 4 day per week program.',
    level: "['Intermediate']",
    goal: "['Bodybuilding']",
    equipment: 'Full Gym',
    program_length: '8.0',
    time_per_workout: '60.0',
    total_exercises: '80',
  }];

  const { programs, errors } = buildReferencePrograms(summaries, [
    { title: 'Simple 4 Day Builder', week: 'Week 1', day: 'Day 1', exercise_name: 'Squat', sets: '3', reps: '5' },
    { title: 'Simple 4 Day Builder', week: 'Week 1', day: 'Day 99', exercise_name: 'Bad Day' },
  ]);

  assert.equal(programs.length, 1);
  assert.equal(programs[0].weeks[0].days[0].exercises[0].originalName, 'Squat');
  assert.equal(errors[0].reason, 'invalid_day');
});

test('normalizes one exercise row into the reference exercise shape', () => {
  const result = normalizeExerciseRow({
    week: 'Week 2',
    day: 'Day 3',
    exercise_name: ' Barbell Squat ',
    sets: '5',
    reps: '3-5',
    intensity: 'RPE 8',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.normalizedName, 'barbell squat');
  assert.deepEqual(result.value.reps, { type: 'range', min: 3, max: 5, raw: '3-5' });
});

test('analyzes summary-only dataset and reports duplicates plus unavailable exercise stats', () => {
  const csv = [
    'title,description,level,goal,equipment,program_length,time_per_workout,total_exercises,created,last_edit',
    'Simple 4 Day Builder,A 4 day per week program.,[Intermediate],[Bodybuilding],Full Gym,8.0,60.0,80,2024,2025',
    'Simple 4 Day Builder,A 4 day per week program.,[Intermediate],[Bodybuilding],Full Gym,8.0,60.0,80,2024,2025',
    ',Missing title,[Novice],[Athletics],Garage Gym,4.0,45.0,10,2024,2025',
  ].join('\n');

  const report = analyzeProgramDataset({ summaryCsvContent: csv });

  assert.equal(report.totals.programs, 2);
  assert.equal(report.totals.exerciseRows, 'NOT AVAILABLE');
  assert.equal(report.totals.uniqueExercises, 'NOT AVAILABLE');
  assert.equal(report.dataQuality.duplicatePrograms[0].key, 'simple 4 day builder');
  assert.equal(report.dataQuality.malformedNormalizedRows[0].reason, 'missing_title');
  assert.equal(report.goalCoverage.hypertrophy.programs, 2);
  assert.equal(report.exerciseMatching.unavailableReason, 'No detailed exercise CSV was available in the inspected repository.');
});
