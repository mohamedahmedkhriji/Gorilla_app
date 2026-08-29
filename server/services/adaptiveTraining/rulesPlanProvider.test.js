import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';
import {
  PLAN_ARTIFACT_TYPES,
  PlanProviderResultError,
} from './planProviderResult.js';
import {
  generateRulesPlanResult,
} from './rulesPlanProvider.js';
import {
  getPhaseForWeek,
} from './rulesPlanDraft.js';

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

const fakeContext = {
  normalizedGoal: 'muscle_gain',
  normalizedLevel: 'intermediate',
  pool: [
    { id: 1 },
    { id: 2 },
  ],
};

test('returns a rules provider result', async () => {
  const expectedDraft = buildValidDraft();

  const result = await generateRulesPlanResult(
    {},
    {},
    {
      buildPlanningContext: async () => fakeContext,
      buildDraft: () => expectedDraft,
    },
  );

  assert.equal(result.provider, PLAN_PROVIDERS.RULES);
  assert.equal(result.planSource, 'repset_rules');
  assert.equal(
    result.artifactType,
    PLAN_ARTIFACT_TYPES.RULES_DRAFT,
  );
  assert.equal(result.draft, expectedDraft);
  assert.equal(result.artifact, expectedDraft);
  assert.equal(result.payload, null);
});

test('forces cycleWeeks to 8', async () => {
  let receivedOptions;

  const buildPlanningContext = async (
    conn,
    options,
  ) => {
    receivedOptions = options;
    return fakeContext;
  };

  await generateRulesPlanResult(
    {},
    { cycleWeeks: 12 },
    {
      buildPlanningContext,
      buildDraft: () => buildValidDraft(),
    },
  );

  assert.equal(receivedOptions.cycleWeeks, 8);
});

test('passes splitPreference to the draft builder', async () => {
  let receivedDraftInput;

  await generateRulesPlanResult(
    {},
    { splitPreference: 'upper_lower' },
    {
      buildPlanningContext: async () => fakeContext,
      buildDraft: (input) => {
        receivedDraftInput = input;
        return buildValidDraft();
      },
    },
  );

  assert.equal(
    receivedDraftInput.planningContext,
    fakeContext,
  );
  assert.equal(
    receivedDraftInput.splitPreference,
    'upper_lower',
  );
});

test('adds metadata without private profile fields', async () => {
  const result = await generateRulesPlanResult(
    {},
    {
      userId: 123,
      gender: 'female',
      athleteGoal: 'speed',
    },
    {
      buildPlanningContext: async () => fakeContext,
      buildDraft: () => buildValidDraft(),
    },
  );

  assert.deepEqual(result.metadata, {
    engine: 'repset-rules-v1',
    cycleWeeks: 8,
    daysPerWeek: 2,
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    catalogExerciseCount: 2,
  });
  assert.equal('userId' in result.metadata, false);
  assert.equal('gender' in result.metadata, false);
  assert.equal('athleteGoal' in result.metadata, false);
});

test('rejects an invalid generated draft', async () => {
  await assert.rejects(
    () => generateRulesPlanResult(
      {},
      {},
      {
        buildPlanningContext: async () => fakeContext,
        buildDraft: () => ({
          ...buildValidDraft(),
          weeks: [],
        }),
      },
    ),
    PlanProviderResultError,
  );
});

test('propagates catalog context loading errors', async () => {
  const error = new Error('Catalog unavailable');

  await assert.rejects(
    () => generateRulesPlanResult(
      {},
      {},
      {
        buildPlanningContext: async () => {
          throw error;
        },
        buildDraft: () => buildValidDraft(),
      },
    ),
    error,
  );
});

test('rejects a missing database connection', async () => {
  await assert.rejects(
    () => generateRulesPlanResult(null),
    TypeError,
  );
});
