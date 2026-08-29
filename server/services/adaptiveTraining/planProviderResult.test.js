import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';

import {
  PLAN_ARTIFACT_TYPES,
  PlanProviderResultError,
  createPlanProviderResult,
  validatePlanPersistencePayload,
} from './planProviderResult.js';
import {
  getPhaseForWeek,
} from './rulesPlanDraft.js';

const validPayload = {
  planName: 'RepSet Hypertrophy Plan',
  description: 'Eight-week personalized program.',
  cycleWeeks: 8,
  selectedDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  weeklyWorkouts: [
    {
      dayName: 'Monday',
      sessionName: 'Upper Body',
      exercises: [],
    },
  ],
};

const buildValidDraft = () => {
  const selectedDays = ['Monday', 'Thursday'];

  return {
    planName: 'RepSet Rules Plan',
    description: 'Eight-week adaptive training plan.',
    programType: 'upper_lower',
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    daysPerWeek: 2,
    cycleWeeks: 8,
    selectedDays,
    weeks: Array.from({ length: 8 }, (_, index) => {
      const weekNumber = index + 1;

      return {
        weekNumber,
        phaseName: getPhaseForWeek(weekNumber).label,
        workouts: selectedDays.map((dayName) => ({
          dayName,
          workoutName: `Week ${weekNumber} - Full Body`,
          workoutType: 'Full Body',
          estimatedDurationMinutes: 60,
          notes: null,
          exercises: [
            {
              exerciseCatalogId: 153,
              exerciseName: 'Bench Press',
              targetMuscles: ['Chest', 'Triceps'],
              sets: 4,
              reps: '8-10',
              restSeconds: 90,
              targetWeight: null,
              tempo: null,
              rpeTarget: 7.5,
              notes: null,
            },
          ],
        })),
      };
    }),
    summary: {
      weeklyFatigueScore: 40,
      weeklyCapacity: 60,
      cardioGoals: null,
    },
  };
};

test('creates a rules provider result', () => {
  const result = createPlanProviderResult({
    provider: PLAN_PROVIDERS.RULES,
    payload: validPayload,
  });

  assert.equal(result.provider, PLAN_PROVIDERS.RULES);
  assert.equal(result.planSource, 'repset_rules');
  assert.equal(
    result.artifactType,
    PLAN_ARTIFACT_TYPES.CUSTOM_PAYLOAD,
  );
  assert.equal(result.artifact, validPayload);
  assert.equal(result.payload, validPayload);
  assert.equal(result.draft, null);
  assert.deepEqual(result.warnings, []);
});

test('preserves normalized plan and metadata', () => {
  const normalizedPlan = {
    planName: 'Normalized Plan',
    workoutsByPhase: [],
  };

  const result = createPlanProviderResult({
    provider: PLAN_PROVIDERS.CLAUDE,
    payload: validPayload,
    normalizedPlan,
    metadata: {
      model: 'claude',
    },
  });

  assert.equal(result.normalizedPlan, normalizedPlan);
  assert.deepEqual(result.metadata, {
    model: 'claude',
  });
});

test('maps legacy rules to the existing template source', () => {
  const result = createPlanProviderResult({
    provider: PLAN_PROVIDERS.LEGACY_RULES,
    payload: validPayload,
  });

  assert.equal(result.planSource, 'template');
});

test('rejects an unsupported provider', () => {
  assert.throws(
    () => createPlanProviderResult({
      provider: 'unsupported',
      payload: validPayload,
    }),
    PlanProviderResultError,
  );
});

test('reports invalid persistence fields', () => {
  const validation = validatePlanPersistencePayload({
    planName: '',
    description: null,
    cycleWeeks: 12,
    selectedDays: [],
    weeklyWorkouts: [],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length, 5);
});

test('rejects an invalid payload when creating a result', () => {
  assert.throws(
    () => createPlanProviderResult({
      provider: PLAN_PROVIDERS.RULES,
      payload: {},
    }),
    (error) => {
      assert.equal(
        error.name,
        'PlanProviderResultError',
      );

      assert.ok(error.details.length > 0);
      return true;
    },
  );
});

test('creates a rules draft provider result', () => {
  const draft = buildValidDraft();

  const result = createPlanProviderResult({
    provider: PLAN_PROVIDERS.RULES,
    draft,
  });

  assert.equal(
    result.artifactType,
    PLAN_ARTIFACT_TYPES.RULES_DRAFT,
  );
  assert.equal(result.artifact, draft);
  assert.equal(result.draft, draft);
  assert.equal(result.payload, null);
});

test('rejects results with both payload and draft', () => {
  assert.throws(
    () => createPlanProviderResult({
      provider: PLAN_PROVIDERS.RULES,
      payload: validPayload,
      draft: buildValidDraft(),
    }),
    PlanProviderResultError,
  );
});

test('rejects results with neither payload nor draft', () => {
  assert.throws(
    () => createPlanProviderResult({
      provider: PLAN_PROVIDERS.RULES,
    }),
    PlanProviderResultError,
  );
});

test('reports invalid draft fields when creating a result', () => {
  assert.throws(
    () => createPlanProviderResult({
      provider: PLAN_PROVIDERS.RULES,
      draft: {
        ...buildValidDraft(),
        weeks: [],
      },
    }),
    (error) => {
      assert.equal(
        error.name,
        'PlanProviderResultError',
      );
      assert.equal(
        error.message,
        'Invalid rules plan draft',
      );
      assert.ok(
        error.details.some(
          (detail) => detail.includes('weeks must contain 8'),
        ),
      );
      return true;
    },
  );
});
