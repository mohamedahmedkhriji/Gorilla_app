import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCompleteGeneratedProgram,
  createStaticCatalogProvider,
  generateAndPersistProgramEnginePlan,
  normalizeTrainingProfile,
  routeProgramEngineRequest,
} from '../index.js';

const ex = (id, name, {
  muscle = 'Chest',
  equipment = 'Barbell',
  mechanics = 'compound',
  forceType = 'push',
} = {}) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
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

const catalog = [
  ex(1, 'Barbell Bench Press', { muscle: 'Chest' }),
  ex(2, 'Incline Dumbbell Press', { muscle: 'Chest', equipment: 'Dumbbell' }),
  ex(3, 'Standing Dumbbell Shoulder Press', { muscle: 'Shoulders', equipment: 'Dumbbell' }),
  ex(4, 'Lat Pulldown', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(5, 'Seated Cable Row', { muscle: 'Back', equipment: 'Cable', forceType: 'pull' }),
  ex(6, 'Chest Supported Row', { muscle: 'Back', equipment: 'Machine', forceType: 'pull' }),
  ex(7, 'Reverse Pec Deck', { muscle: 'Shoulders', equipment: 'Machine', mechanics: 'isolation' }),
  ex(8, 'Dumbbell Lateral Raise', { muscle: 'Shoulders', equipment: 'Dumbbell', mechanics: 'isolation' }),
  ex(9, 'Barbell Back Squat', { muscle: 'Quadriceps' }),
  ex(10, 'Conventional Deadlift', { muscle: 'Hamstrings', forceType: 'pull' }),
  ex(11, 'Romanian Deadlift', { muscle: 'Hamstrings', forceType: 'pull' }),
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

const provider = createStaticCatalogProvider(catalog);

const baseInput = {
  athleteIdentity: 'Bodybuilding',
  athleteSubCategoryId: 'hypertrophy',
  experienceLevel: 'Intermediate',
  workoutDays: 5,
  sessionDuration: 60,
  gender: 'Man',
  aiTrainingFocus: 'balanced',
  aiRecoveryPriority: 'balanced',
};

class FakeConn {
  constructor({ existingProgram = null, activeAssignment = null } = {}) {
    this.existingProgram = existingProgram;
    this.activeAssignment = activeAssignment;
    this.calls = [];
    this.nextProgramId = 100;
    this.nextWorkoutId = 1000;
    this.nextAssignmentId = 5000;
  }

  async query(sql, params = []) {
    return this.execute(sql, params);
  }

  async execute(sql, params = []) {
    this.calls.push({ sql, params });
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM program_assignments pa JOIN programs p')) {
      return [this.existingProgram ? [this.existingProgram] : []];
    }
    if (normalizedSql.startsWith('SELECT id, program_id FROM program_assignments')) {
      return [this.activeAssignment ? [this.activeAssignment] : []];
    }
    if (normalizedSql.startsWith('INSERT INTO programs')) {
      this.programInsertParams = params;
      return [{ insertId: this.nextProgramId++ }];
    }
    if (normalizedSql.startsWith('INSERT INTO workouts')) {
      this.workoutInsertParams = this.workoutInsertParams || [];
      this.workoutInsertParams.push(params);
      return [{ insertId: this.nextWorkoutId++ }];
    }
    if (normalizedSql.startsWith('INSERT INTO workout_exercises')) {
      this.exerciseInsertParams = this.exerciseInsertParams || [];
      this.exerciseInsertParams.push(params);
      return [{ insertId: this.exerciseInsertParams.length }];
    }
    if (normalizedSql.startsWith('INSERT INTO program_assignments')) {
      return [{ insertId: this.nextAssignmentId++ }];
    }
    return [{ affectedRows: 1 }];
  }

  count(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    return this.calls.filter((call) => regex.test(call.sql)).length;
  }
}

test('AI Coach route sends supported profiles through Program Engine v1', () => {
  const route = routeProgramEngineRequest({
    onboardingInput: baseInput,
    splitPreference: 'auto',
  });

  assert.equal(route.route, 'program_engine_v1');
  assert.equal(route.profile.goal, 'hypertrophy');
});

test('HYROX, boxing, and custom requests bypass Program Engine', () => {
  assert.equal(routeProgramEngineRequest({
    onboardingInput: { ...baseInput, athleteIdentity: 'hyrox', athleteSubCategoryId: 'endurance' },
    splitPreference: 'auto',
  }).route, 'legacy_hyrox');
  assert.equal(routeProgramEngineRequest({
    onboardingInput: { ...baseInput, athleteIdentity: 'box' },
    splitPreference: 'auto',
  }).route, 'legacy_boxing');
  assert.equal(routeProgramEngineRequest({
    onboardingInput: baseInput,
    splitPreference: 'custom',
  }).route, 'manual_custom');
});

test('compatible split override is applied and incompatible override is rejected', async () => {
  const upperLower = await buildCompleteGeneratedProgram(normalizeTrainingProfile({
    ...baseInput,
    workoutDays: 4,
  }), {
    catalogProvider: provider,
    splitPreference: 'upper_lower',
  });

  assert.equal(upperLower.split.id, 'upper_lower');
  assert.equal(upperLower.generationMetadata.splitOverrideApplied, false);

  await assert.rejects(
    () => buildCompleteGeneratedProgram(normalizeTrainingProfile(baseInput), {
      catalogProvider: provider,
      splitPreference: 'upper_lower',
    }),
    (error) => error?.details?.code === 'INCOMPATIBLE_SPLIT_OVERRIDE',
  );
});

test('persists all eight weeks into existing program/workout tables', async () => {
  const conn = new FakeConn();
  const result = await generateAndPersistProgramEnginePlan(conn, {
    userId: 7,
    gymId: 3,
    onboardingInput: baseInput,
    splitPreference: 'auto',
    catalogProvider: provider,
  });

  assert.equal(result.route, 'program_engine_v1');
  assert.equal(result.assignedProgram.cycleWeeks, 8);
  assert.equal(conn.count(/^INSERT INTO programs/i), 1);
  assert.equal(conn.count(/^INSERT INTO workouts/i), 40);
  assert.equal(conn.programInsertParams[11], 'program_engine_brain_v1');
  assert.equal(conn.programInsertParams[12], 'ppl_upper_lower');
  assert.equal(JSON.parse(conn.programInsertParams[13]).generationMetadata.trainingBrainSelectedStrategy, 'ppl_upper_lower');
  assert.ok(conn.count(/^INSERT INTO workout_exercises/i) > 0);
  assert.equal(conn.workoutInsertParams[0][7], 1);
  assert.equal(conn.workoutInsertParams.at(-1)[7], 8);
  assert.ok(conn.exerciseInsertParams.every((params) => Number.isInteger(params[9])));
});

test('fat loss production path persists Brain prescribed frequency instead of availability', async () => {
  const conn = new FakeConn();
  const result = await generateAndPersistProgramEnginePlan(conn, {
    userId: 12,
    gymId: 3,
    onboardingInput: {
      ...baseInput,
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'fat_loss',
      experienceLevel: 'beginner',
      workoutDays: 6,
      sessionDuration: 45,
      gender: 'Man',
    },
    splitPreference: 'auto',
    catalogProvider: provider,
  });

  const metadata = JSON.parse(conn.programInsertParams[13]);

  assert.equal(result.trainingStrategy.schedule.availableDaysPerWeek, 6);
  assert.equal(result.trainingStrategy.schedule.prescribedDaysPerWeek, 3);
  assert.equal(result.completeProgram.split.id, 'fat_loss_3_day');
  assert.equal(result.assignedProgram.daysPerWeek, 3);
  assert.equal(conn.programInsertParams[7], 3);
  assert.equal(conn.programInsertParams[11], 'program_engine_brain_v1');
  assert.equal(conn.programInsertParams[12], 'fat_loss_3_day');
  assert.equal(metadata.generationMetadata.availableDaysPerWeek, 6);
  assert.equal(metadata.generationMetadata.prescribedDaysPerWeek, 3);
  assert.equal(metadata.generationMetadata.referenceEvidence.dataset, 'fitness.project');
  assert.equal(conn.count(/^INSERT INTO workouts/i), 24);
});

test('duplicate submit reuses the active generated program instead of inserting another copy', async () => {
  const existingProgram = {
    id: 77,
    name: 'Existing Engine Plan',
    program_type: 'program_engine',
    goal: 'hypertrophy',
    days_per_week: 5,
    cycle_weeks: 8,
    assignment_id: 88,
  };
  const conn = new FakeConn({ existingProgram });

  const result = await generateAndPersistProgramEnginePlan(conn, {
    userId: 7,
    gymId: 3,
    onboardingInput: baseInput,
    splitPreference: 'auto',
    catalogProvider: provider,
  });

  assert.equal(result.reusedExistingProgram, true);
  assert.equal(result.assignedProgram.id, 77);
  assert.equal(conn.count(/^INSERT INTO programs/i), 0);
  assert.equal(conn.count(/^INSERT INTO workouts/i), 0);
});

test('endurance programs store cardio prescriptions without fake exercises', async () => {
  const conn = new FakeConn();
  await generateAndPersistProgramEnginePlan(conn, {
    userId: 9,
    gymId: 4,
    onboardingInput: {
      ...baseInput,
      athleteIdentity: 'Cardio',
      athleteSubCategoryId: 'endurance',
      workoutDays: 3,
      sessionDuration: 45,
      experienceLevel: 'beginner',
    },
    splitPreference: 'auto',
    catalogProvider: provider,
  });

  assert.equal(conn.count(/^INSERT INTO workouts/i), 24);
  assert.equal(conn.count(/^INSERT INTO workout_exercises/i), 0);
  assert.ok(conn.workoutInsertParams.every((params) => params[9]));
});

test('catalog failures stop Program Engine instead of falling back', async () => {
  const conn = new FakeConn();
  await assert.rejects(
    () => generateAndPersistProgramEnginePlan(conn, {
      userId: 7,
      gymId: 3,
      onboardingInput: baseInput,
      splitPreference: 'auto',
      catalogProvider: async () => [],
    }),
    (error) => error.name === 'ProgramEngineOrchestrationError',
  );
});
