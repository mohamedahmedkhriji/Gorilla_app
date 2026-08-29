import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAN_PROVIDERS,
} from './planProviderPolicy.js';

import {
  PlanProviderResultError,
  createPlanProviderResult,
  validatePlanPersistencePayload,
} from './planProviderResult.js';

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

test('creates a rules provider result', () => {
  const result = createPlanProviderResult({
    provider: PLAN_PROVIDERS.RULES,
    payload: validPayload,
  });

  assert.equal(result.provider, PLAN_PROVIDERS.RULES);
  assert.equal(result.planSource, 'repset_rules');
  assert.equal(result.payload, validPayload);
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
