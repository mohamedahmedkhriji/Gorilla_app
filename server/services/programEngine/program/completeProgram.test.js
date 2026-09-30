import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCompleteGeneratedProgram,
  buildProgramBlueprint,
  createStaticCatalogProvider,
  normalizeTrainingProfile,
  resolveExerciseForSlot,
  validateCompleteGeneratedProgram,
} from '../index.js';
import { parseGenerationConstraints } from '../resolver/constraints.js';

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

const provider = createStaticCatalogProvider(fixtureCatalog);

const baseInput = {
  gender: 'Man',
  age: 30,
  height: 180,
  weight: 82,
  bodyType: 'Mesomorph',
  appMotivation: 'guided_start',
  athleteIdentity: 'Bodybuilding',
  athleteSubCategoryId: 'hypertrophy',
  experienceLevel: 'intermediate',
  workoutDays: 5,
  sessionDuration: 60,
  aiTrainingFocus: 'Balanced',
  aiRecoveryPriority: 'Balanced',
};

const profileFor = (patch = {}) => normalizeTrainingProfile({ ...baseInput, ...patch });

const buildProgram = (patch = {}, options = {}) => buildCompleteGeneratedProgram(profileFor(patch), {
  catalogProvider: provider,
  ...options,
});

const slot = (movementPattern, primaryMuscleGroup = 'chest', role = 'primary_compound') => ({
  slotId: `test_${movementPattern}`,
  movementPattern,
  primaryMuscleGroup,
  role,
  priority: 1,
  required: true,
});

test('resolves covered resistance slot movement patterns', () => {
  [
    ['horizontal_press', 'chest'],
    ['incline_press', 'chest'],
    ['vertical_press', 'shoulders'],
    ['vertical_pull', 'back'],
    ['horizontal_pull', 'back'],
    ['squat_pattern', 'quadriceps'],
    ['hip_hinge', 'hamstrings'],
    ['quad_accessory', 'quadriceps', 'accessory'],
    ['hamstring_accessory', 'hamstrings', 'accessory'],
    ['biceps', 'biceps', 'isolation'],
    ['triceps', 'triceps', 'isolation'],
    ['lateral_delt', 'shoulders', 'isolation'],
    ['rear_delt', 'shoulders', 'isolation'],
    ['calves', 'calves', 'isolation'],
    ['core', 'core', 'core'],
  ].forEach(([pattern, muscle, role]) => {
    const result = resolveExerciseForSlot({
      slot: slot(pattern, muscle, role),
      sessionType: 'test',
      catalog: fixtureCatalog,
      constraints: parseGenerationConstraints(),
    });
    assert.equal(Number.isInteger(result.exerciseId), true, pattern);
    assert.ok(result.slug, pattern);
  });
});

test('powerlifting competition movements resolve specifically', () => {
  const squat = resolveExerciseForSlot({ slot: slot('squat_pattern', 'quadriceps'), sessionType: 'pl_squat_bench', catalog: fixtureCatalog, constraints: parseGenerationConstraints() });
  const bench = resolveExerciseForSlot({ slot: slot('bench', 'chest'), sessionType: 'pl_squat_bench', catalog: fixtureCatalog, constraints: parseGenerationConstraints() });
  const deadlift = resolveExerciseForSlot({ slot: slot('deadlift', 'hamstrings'), sessionType: 'pl_deadlift_bench', catalog: fixtureCatalog, constraints: parseGenerationConstraints() });

  assert.equal(squat.name, 'Barbell Back Squat');
  assert.equal(bench.name, 'Barbell Bench Press');
  assert.equal(deadlift.name, 'Conventional Deadlift');
});

test('missing powerlifting competition movement fails clearly', () => {
  assert.throws(
    () => resolveExerciseForSlot({
      slot: slot('deadlift', 'hamstrings'),
      sessionType: 'pl_deadlift_bench',
      catalog: fixtureCatalog.filter((exercise) => !exercise.name.toLowerCase().includes('deadlift')),
      constraints: parseGenerationConstraints(),
    }),
    /REQUIRED_COMPETITION_EXERCISE_UNRESOLVED/,
  );
});

test('equipment and movement constraints are deterministic and conservative', async () => {
  const noBarbell = await buildProgram({ aiEquipmentNotes: 'No barbell' });
  assert.equal(
    noBarbell.weeks[0].days.flatMap((day) => day.exercises || []).some((exercise) => /barbell/i.test(exercise.exercise.equipment || exercise.exercise.name)),
    false,
  );

  const dumbbellOnly = await buildProgram({ aiEquipmentNotes: 'Dumbbells only' });
  assert.equal(
    dumbbellOnly.weeks[0].days.flatMap((day) => day.exercises || []).every((exercise) => /dumbbell/i.test(exercise.exercise.equipment || exercise.exercise.name)),
    true,
  );

  await assert.rejects(
    () => buildProgram({ aiLimitations: 'avoid overhead press' }),
    /REQUIRED_EXERCISE_UNRESOLVED/,
  );

  await assert.rejects(
    () => buildProgram({
      athleteSubCategoryId: 'powerlifting',
      workoutDays: 4,
      aiLimitations: 'no deadlift',
    }),
    (error) => error.code === 'POWERLIFTING_COMPETITION_MOVEMENT_EXCLUDED',
  );

  await assert.doesNotReject(() => buildProgram({ aiEquipmentNotes: 'I like quiet workouts' }));
});

test('generates and validates complete programs for supported goals', async () => {
  const cases = [
    { athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 },
    { athleteSubCategoryId: 'powerlifting', workoutDays: 4, sessionDuration: 60 },
    { athleteSubCategoryId: 'cutting', workoutDays: 4, sessionDuration: 60 },
    { athleteSubCategoryId: 'bulking', workoutDays: 5, sessionDuration: 60 },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'fat_loss', workoutDays: 3, sessionDuration: 45, experienceLevel: 'beginner' },
    { athleteIdentity: 'Cardio', athleteSubCategoryId: 'endurance', workoutDays: 3, sessionDuration: 45, experienceLevel: 'beginner' },
  ];

  for (const patch of cases) {
    const program = await buildProgram(patch);
    const validation = validateCompleteGeneratedProgram(program);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.equal(program.weeks.length, 8);
    assert.equal(program.weeks.every((week) => week.days.length === 7), true);
    assert.ok(program.progressionPolicy.rule);
  }
});

test('prescriptions differ by role and goal', async () => {
  const hypertrophy = await buildProgram({ athleteSubCategoryId: 'hypertrophy', workoutDays: 5, sessionDuration: 60 });
  const push = hypertrophy.weeks[0].days.find((day) => day.sessionType === 'push');
  const compound = push.exercises.find((exercise) => exercise.slot.role === 'primary_compound');
  const isolation = push.exercises.find((exercise) => exercise.slot.role === 'isolation');
  assert.ok(compound.prescription.reps.max <= 10);
  assert.ok(isolation.prescription.reps.min >= 10);

  const powerlifting = await buildProgram({ athleteSubCategoryId: 'powerlifting', workoutDays: 4, sessionDuration: 60 });
  const bench = powerlifting.weeks[0].days.flatMap((day) => day.exercises || []).find((exercise) => exercise.slot.movementPattern === 'bench');
  assert.ok(bench.prescription.reps.max <= 6);
  assert.ok(bench.prescription.restSeconds >= 180);
});

test('duration targets create meaningful differences and preserve required movement', async () => {
  const compact = await buildProgram({ workoutDays: 2, sessionDuration: 30, experienceLevel: 'beginner' });
  const standard = await buildProgram({ workoutDays: 2, sessionDuration: 60, experienceLevel: 'beginner' });
  const expanded = await buildProgram({ workoutDays: 2, sessionDuration: 90, experienceLevel: 'advanced' });
  const firstTraining = (program) => program.weeks[0].days.find((day) => day.type === 'training');

  assert.ok(firstTraining(compact).estimatedDurationMinutes <= 36);
  assert.ok(firstTraining(expanded).exercises.length >= firstTraining(standard).exercises.length);
  assert.equal(firstTraining(compact).exercises.some((exercise) => exercise.slot.required), true);
});

test('progression creates 8 non-identical weeks with fatigue management week', async () => {
  const program = await buildProgram();
  assert.equal(program.weeks.length, 8);
  assert.equal(program.progressionPolicy.weeks[5].stress, 'reduced');
  const week1Effort = program.weeks[0].days.flatMap((day) => day.exercises || [])[0].prescription.effort.target;
  const week8Effort = program.weeks[7].days.flatMap((day) => day.exercises || [])[0].prescription.effort.target;
  assert.notEqual(week1Effort, week8Effort);
});

test('complete program generation is deterministic', async () => {
  const profile = profileFor({ athleteSubCategoryId: 'powerlifting', workoutDays: 4, sessionDuration: 60 });
  const first = await buildCompleteGeneratedProgram(profile, { catalogProvider: provider });
  const second = await buildCompleteGeneratedProgram(profile, { catalogProvider: provider });
  assert.deepEqual(second, first);
});

test('gender, cycle, body type, and motivation do not alter core program', async () => {
  const man = await buildProgram({ gender: 'Man', bodyType: 'Ectomorph', appMotivation: 'guided_start' });
  const woman = await buildProgram({
    gender: 'Woman',
    bodyType: 'Endomorph',
    appMotivation: 'confidence',
    periodCycle: { lastPeriodStart: '2026-09-10', typicalCycleLength: 29 },
  });

  const core = (program) => program.weeks.map((week) => week.days.map((day) => ({
    type: day.type,
    sessionType: day.sessionType,
    exercises: (day.exercises || []).map((exercise) => exercise.exercise.exerciseId),
    cardio: day.cardioPrescription?.sessionPurpose || null,
  })));

  assert.deepEqual(core(woman), core(man));
  assert.equal(woman.generationMetadata.cycleContextPresent, true);
});

test('HYROX and Boxing bypassed profiles cannot generate complete programs', async () => {
  await assert.rejects(
    () => buildProgram({ athleteIdentity: 'hyrox' }),
    /Bypassed profiles cannot enter/,
  );
  await assert.rejects(
    () => buildProgram({ athleteIdentity: 'Box' }),
    /Bypassed profiles cannot enter/,
  );
});

test('catalog provider is called once and dataset is not required', async () => {
  let calls = 0;
  const program = await buildCompleteGeneratedProgram(profileFor(), {
    catalogProvider: async () => {
      calls += 1;
      return fixtureCatalog;
    },
  });

  assert.equal(calls, 1);
  assert.equal(program.generationMetadata.datasetRequired, false);
  assert.ok(program.generationKey);
});

test('blueprint can be generated independently before complete program generation', () => {
  const blueprint = buildProgramBlueprint(profileFor());
  assert.equal(blueprint.split.id, 'ppl_upper_lower');
});
