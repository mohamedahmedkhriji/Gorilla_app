import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStaticCatalogProvider,
  generateBrainDrivenProgram,
  loadLocalReferencePrograms,
} from '../index.js';

const ex = (id, name, {
  slug = null,
  muscle = 'Chest',
  equipment = 'Barbell',
  mechanics = 'compound',
  forceType = 'push',
} = {}) => ({
  id,
  name,
  slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  equipment,
  difficultyLevel: 2,
  mechanics,
  forceType,
  muscle,
  bodyPart: muscle,
  categories: [{ name: muscle, slug: muscle.toLowerCase().replace(/\s+/g, '-') }],
  muscles: [{ name: muscle, muscleGroup: muscle, role: 'primary' }],
  primaryMedia: { mediaType: 'video', audience: 'unisex', url: `https://cdn.test/${id}.mp4` },
});

const fixtureCatalog = [
  ex(1, 'Barbell Bench Press', { muscle: 'Chest', equipment: 'Barbell' }),
  ex(2, 'Incline Dumbbell Press', { muscle: 'Chest', equipment: 'Dumbbell' }),
  ex(3, 'Standing Dumbbell Shoulder Press', { muscle: 'Shoulders', equipment: 'Dumbbell' }),
  ex(4, 'Lat Pulldown', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(5, 'Seated Cable Row', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(6, 'Chest Supported Row', { muscle: 'Back', equipment: 'Machine', forceType: 'pull' }),
  ex(7, 'Reverse Pec Deck', { muscle: 'Shoulders', equipment: 'Machine', mechanics: 'isolation' }),
  ex(8, 'Dumbbell Lateral Raise', { muscle: 'Shoulders', equipment: 'Dumbbell', mechanics: 'isolation' }),
  ex(9, 'Barbell Back Squat', { muscle: 'Quadriceps', equipment: 'Barbell' }),
  ex(10, 'Conventional Deadlift', { muscle: 'Hamstrings', equipment: 'Barbell', forceType: 'pull' }),
  ex(11, 'Romanian Deadlift', { muscle: 'Hamstrings', equipment: 'Barbell', forceType: 'pull' }),
  ex(12, 'Dumbbell Romanian Deadlift', { muscle: 'Hamstrings', equipment: 'Dumbbell', forceType: 'pull' }),
  ex(13, 'Bulgarian Split Squat', { muscle: 'Glutes', equipment: 'Dumbbell' }),
  ex(14, 'Leg Extension', { muscle: 'Quadriceps', equipment: 'Machine', mechanics: 'isolation' }),
  ex(15, 'Lying Leg Curl', { muscle: 'Hamstrings', equipment: 'Machine', mechanics: 'isolation' }),
  ex(16, 'Standing Calf Raise', { muscle: 'Calves', equipment: 'Machine', mechanics: 'isolation' }),
  ex(17, 'Cable Crunch', { muscle: 'Abs', equipment: 'Cable', mechanics: 'isolation' }),
  ex(18, 'Dumbbell Curl', { muscle: 'Biceps', equipment: 'Dumbbell', mechanics: 'isolation', forceType: 'pull' }),
  ex(19, 'Triceps Pressdown', { muscle: 'Triceps', equipment: 'Cable', mechanics: 'isolation' }),
  ex(20, 'Cable Fly', { muscle: 'Chest', equipment: 'Cable', mechanics: 'isolation' }),
  ex(21, 'Goblet Squat', { muscle: 'Quadriceps', equipment: 'Dumbbell' }),
  ex(22, 'Dumbbell Bench Press', { muscle: 'Chest', equipment: 'Dumbbell' }),
  ex(23, 'Dumbbell Row', { muscle: 'Back', equipment: 'Dumbbell', forceType: 'pull' }),
  ex(24, 'Plank', { muscle: 'Abs', equipment: 'Bodyweight', mechanics: 'isolation' }),
];

const catalogProvider = createStaticCatalogProvider(fixtureCatalog);

const baseInput = {
  age: 30,
  height: 180,
  weight: 82,
  bodyType: 'Mesomorph',
  appMotivation: 'guided_start',
  preferredTime: 'Evening',
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
  aiEquipmentNotes: 'Full gym',
};

const generate = (patch = {}, options = {}) => generateBrainDrivenProgram({
  ...baseInput,
  ...patch,
}, {
  catalogProvider,
  ...options,
});

const trainingWorkoutCount = (program) =>
  program.weeks.reduce((sum, week) => sum + week.days.filter((day) => day.type === 'training').length, 0);

const resistanceExercises = (program) =>
  program.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises || []);

const summarize = (result) => ({
  architecture: result.trainingStrategy.architecture.splitStrategy,
  availableDaysPerWeek: result.trainingStrategy.schedule.availableDaysPerWeek,
  prescribedDaysPerWeek: result.trainingStrategy.schedule.prescribedDaysPerWeek,
  weeks: result.generatedProgram.weeks.length,
  workouts: trainingWorkoutCount(result.generatedProgram),
  resolvedExerciseCount: result.generatedProgram.generationMetadata.resolvedExerciseCount,
  referenceEvidence: result.referenceEvidence,
  validation: result.validation.valid,
});

const assertCompleteProgram = (result) => {
  assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors, null, 2));
  assert.equal(result.generatedProgram.weeks.length, 8);
  assert.equal(result.generatedProgram.weeks.every((week) => week.days.length === 7), true);
  assert.equal(result.generatedProgram.split.id, result.trainingStrategy.architecture.selectedStrategy);
  assert.equal(result.generatedProgram.daysPerWeek, result.trainingStrategy.schedule.prescribedDaysPerWeek);
  assert.equal(resistanceExercises(result.generatedProgram).every((entry) =>
    Number.isInteger(entry.exercise.exerciseId) && entry.exercise.slug), true);
};

test('loads real local fitness.project reference artifact with provenance', async () => {
  const reference = await loadLocalReferencePrograms();

  assert.equal(reference.metadata.dataset, 'fitness.project');
  assert.equal(reference.metadata.sourceFile, 'Data/program_summary.csv');
  assert.equal(reference.metadata.totalRows, 2598);
  assert.equal(reference.metadata.acceptedRows, 2561);
  assert.equal(reference.metadata.duplicatePrograms, 37);
  assert.equal(reference.metadata.invalidRows, 0);
  assert.equal(reference.metadata.datasetVersion, '503405d5907c6432');
  assert.ok(reference.indexes.byGoal.hypertrophy.length > 0);
  assert.ok(reference.indexes.byGoal.powerlifting.length > 0);
});

test('Test User A generates complete hypertrophy program from Brain strategy', async () => {
  const result = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 5,
    sessionDuration: 60,
  });

  assertCompleteProgram(result);
  assert.equal(result.trainingStrategy.architecture.splitStrategy, 'ppl_upper_lower');
  assert.equal(result.trainingStrategy.schedule.availableDaysPerWeek, 5);
  assert.equal(result.trainingStrategy.schedule.prescribedDaysPerWeek, 5);
  assert.equal(result.referenceEvidence.available, true);
  assert.ok(result.referenceEvidence.matchedCount > 0);
});

test('Test User B uses 6 available days but generates 3 prescribed fat-loss workouts per week', async () => {
  const result = await generate({
    gender: 'Man',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    experienceLevel: 'beginner',
    workoutDays: 6,
    sessionDuration: 45,
  });

  assertCompleteProgram(result);
  assert.equal(result.trainingStrategy.schedule.availableDaysPerWeek, 6);
  assert.equal(result.trainingStrategy.schedule.prescribedDaysPerWeek, 3);
  assert.equal(result.trainingStrategy.architecture.splitStrategy, 'fat_loss_3_day');
  assert.equal(result.generatedProgram.daysPerWeek, 3);
  assert.equal(trainingWorkoutCount(result.generatedProgram), 24);
  assert.notEqual(result.generatedProgram.split.id, 'fat_loss_6_day');
});

test('Test User C generates endurance program with structured cardio and no fake cardio exercises', async () => {
  const result = await generate({
    gender: 'Woman',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'endurance',
    experienceLevel: 'advanced',
    workoutDays: 5,
    sessionDuration: 60,
  });

  assertCompleteProgram(result);
  assert.equal(result.trainingStrategy.architecture.splitStrategy, 'endurance_5_day');
  const trainingDays = result.generatedProgram.weeks[0].days.filter((day) => day.type === 'training');
  assert.equal(trainingDays.every((day) => day.cardioPrescription?.type === 'cardio'), true);
  assert.equal(trainingDays.every((day) => (day.exercises || []).length === 0), true);
});

test('Test User D generates powerlifting program with competition movement exposure', async () => {
  const result = await generate({
    gender: 'Man',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'powerlifting',
    experienceLevel: 'intermediate',
    workoutDays: 4,
    sessionDuration: 90,
  });

  assertCompleteProgram(result);
  assert.equal(result.trainingStrategy.architecture.splitStrategy, 'powerlifting_4_day');
  const patterns = new Set(result.generatedProgram.weeks[0].days
    .flatMap((day) => day.exercises || [])
    .map((entry) => entry.slot.movementPattern));
  assert.equal(patterns.has('squat_pattern'), true);
  assert.equal(patterns.has('bench'), true);
  assert.equal(patterns.has('deadlift'), true);
  const bench = result.generatedProgram.weeks[0].days
    .flatMap((day) => day.exercises || [])
    .find((entry) => entry.slot.movementPattern === 'bench');
  assert.ok(bench.prescription.reps.max <= 6);
});

test('Brain-driven generation works without reference evidence for supported goals', async () => {
  const cases = [
    { athleteIdentity: 'Bodybuilding', athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 },
    { athleteIdentity: 'Bodybuilding', athleteSubCategoryId: 'powerlifting', workoutDays: 4, sessionDuration: 60 },
    { athleteIdentity: 'Bodybuilding', athleteSubCategoryId: 'cutting', workoutDays: 4, sessionDuration: 60 },
    { athleteIdentity: 'Bodybuilding', athleteSubCategoryId: 'bulking', workoutDays: 5, sessionDuration: 60 },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'fat_loss', workoutDays: 6, sessionDuration: 45, experienceLevel: 'beginner' },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'endurance', workoutDays: 5, sessionDuration: 60 },
  ];

  for (const patch of cases) {
    const result = await generate({
      gender: 'Man',
      experienceLevel: patch.experienceLevel || 'intermediate',
      ...patch,
    }, {
      disableReferenceEvidence: true,
    });
    assertCompleteProgram(result);
    assert.equal(result.referenceEvidence.available, false);
  }
});

test('reference evidence supports covered goals and does not block weak/unsupported coverage goals', async () => {
  const hypertrophy = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 5,
    sessionDuration: 60,
  });
  const powerlifting = await generate({
    gender: 'Man',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'powerlifting',
    experienceLevel: 'intermediate',
    workoutDays: 4,
    sessionDuration: 90,
  });
  const fatLoss = await generate({
    gender: 'Man',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    experienceLevel: 'beginner',
    workoutDays: 6,
    sessionDuration: 45,
  });

  assert.ok(hypertrophy.referenceEvidence.matchedCount > 0);
  assert.ok(powerlifting.referenceEvidence.matchedCount > 0);
  assert.ok(['none', 'weak', 'moderate', 'strong'].includes(fatLoss.referenceEvidence.supportLevel));
  assertCompleteProgram(fatLoss);
});

test('Brain-driven generation is deterministic for identical inputs and artifact', async () => {
  const input = {
    gender: 'Man',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    experienceLevel: 'beginner',
    workoutDays: 6,
    sessionDuration: 45,
  };

  const first = await generate(input);
  const second = await generate(input);

  assert.deepEqual(second.trainingStrategy, first.trainingStrategy);
  assert.deepEqual(second.generatedProgram, first.generatedProgram);
});

test('body type remains informational across Brain-driven program generation', async () => {
  const ectomorph = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 5,
    sessionDuration: 60,
    bodyType: 'Ectomorph',
  });
  const endomorph = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 5,
    sessionDuration: 60,
    bodyType: 'Endomorph',
  });

  assert.deepEqual(
    endomorph.generatedProgram.weeks.map((week) => week.days.map((day) => day.sessionType || day.type)),
    ectomorph.generatedProgram.weeks.map((week) => week.days.map((day) => day.sessionType || day.type)),
  );
  assert.equal(endomorph.trainingStrategy.metadata.bodyTypeProgrammingEffect, 'none');
});

test('hard constraints fail safely or respect restrictions', async () => {
  await assert.rejects(
    () => generate({
      gender: 'Man',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'powerlifting',
      experienceLevel: 'intermediate',
      workoutDays: 4,
      sessionDuration: 90,
      aiEquipmentNotes: 'No barbell',
    }),
    /Training Brain did not produce a ready strategy/,
  );

  await assert.rejects(
    () => generate({
      gender: 'Man',
      athleteIdentity: 'Bodybuilding',
      athleteSubCategoryId: 'powerlifting',
      experienceLevel: 'intermediate',
      workoutDays: 4,
      sessionDuration: 90,
      aiLimitations: 'avoid squat',
    }),
    /Training Brain did not produce a ready strategy/,
  );

  const dumbbellOnly = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 4,
    sessionDuration: 60,
    aiEquipmentNotes: 'Dumbbells only',
  });
  assertCompleteProgram(dumbbellOnly);
  assert.equal(
    resistanceExercises(dumbbellOnly.generatedProgram).every((entry) =>
      /dumbbell/i.test(entry.exercise.equipment || entry.exercise.name)),
    true,
  );

  const noOverheadPress = await generate({
    gender: 'Woman',
    athleteIdentity: 'Bodybuilding',
    athleteSubCategoryId: 'hypertrophy',
    experienceLevel: 'intermediate',
    workoutDays: 4,
    sessionDuration: 60,
    aiLimitations: 'avoid overhead press',
  });
  assertCompleteProgram(noOverheadPress);
  assert.equal(
    resistanceExercises(noOverheadPress.generatedProgram)
      .some((entry) => entry.slot.movementPattern === 'vertical_press'),
    false,
  );
});

test('summary helper is derived from actual generated program', async () => {
  const result = await generate({
    gender: 'Man',
    athleteIdentity: 'Cardio',
    athleteSubCategoryId: 'fat_loss',
    experienceLevel: 'beginner',
    workoutDays: 6,
    sessionDuration: 45,
  });
  const summary = summarize(result);

  assert.deepEqual(summary, {
    architecture: 'fat_loss_3_day',
    availableDaysPerWeek: 6,
    prescribedDaysPerWeek: 3,
    weeks: 8,
    workouts: 24,
    resolvedExerciseCount: result.generatedProgram.generationMetadata.resolvedExerciseCount,
    referenceEvidence: result.referenceEvidence,
    validation: true,
  });
});

