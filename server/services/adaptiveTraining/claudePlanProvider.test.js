import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateClaudePlanResult,
} from './claudePlanProvider.js';
import {
  PLAN_ARTIFACT_TYPES,
} from './planProviderResult.js';

const normalizedPlan = {
  planName: 'Claude Plan',
  summary: 'Generated plan',
  weeklySchedule: [],
};

const validPayload = {
  planName: 'Claude Payload',
  description: 'Eight-week payload.',
  cycleWeeks: 8,
  selectedDays: ['Monday'],
  weeklyWorkouts: [
    {
      dayName: 'Monday',
      workoutName: 'Full Body',
      workoutType: 'Full Body',
      estimatedDurationMinutes: 60,
      exercises: [
        {
          name: 'Bench Press',
          sets: 3,
          reps: '8-10',
          restSeconds: 90,
        },
      ],
    },
  ],
};

const buildGeneration = (overrides = {}) => ({
  plan: normalizedPlan,
  model: 'claude-test',
  usedImages: 2,
  attemptsUsed: 1,
  requestTimeoutMs: 30000,
  generatedAt: '2026-08-29T10:00:00.000Z',
  ignoredField: 'nope',
  ...overrides,
});

test('passes profile and bodyImages unchanged to the generator', async () => {
  const profile = {
    userId: 1,
    goal: 'muscle_gain',
  };
  const bodyImages = ['front-image', 'side-image'];
  let receivedInput;

  await generateClaudePlanResult(
    {
      profile,
      bodyImages,
    },
    {
      generateTwoMonthPlanWithClaude: async (input) => {
        receivedInput = input;
        return buildGeneration();
      },
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.equal(receivedInput.profile, profile);
  assert.equal(receivedInput.bodyImages, bodyImages);
});

test('forces cycleWeeks to 8 when building the custom payload', async () => {
  let receivedOptions;

  await generateClaudePlanResult(
    {},
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration(),
      buildCustomProgramPayloadFromClaudePlan: (plan, options) => {
        receivedOptions = options;
        return validPayload;
      },
    },
  );

  assert.equal(receivedOptions.cycleWeeks, 8);
});

test('passes daysPerWeek, split options and exercise anchors', async () => {
  const exerciseAnchors = [
    {
      dayName: 'Monday',
      exercises: ['Bench Press'],
    },
  ];
  let receivedOptions;

  await generateClaudePlanResult(
    {
      daysPerWeek: 4,
      splitPreference: 'upper_lower',
      preferredSplit: 'hybrid',
      exerciseAnchors,
    },
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration(),
      buildCustomProgramPayloadFromClaudePlan: (plan, options) => {
        receivedOptions = options;
        return validPayload;
      },
    },
  );

  assert.deepEqual(receivedOptions, {
    cycleWeeks: 8,
    daysPerWeek: 4,
    splitPreference: 'upper_lower',
    preferredSplit: 'hybrid',
    exerciseAnchors,
  });
});

test('returns a valid custom_payload provider result', async () => {
  const result = await generateClaudePlanResult(
    {},
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration(),
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.equal(result.provider, 'claude');
  assert.equal(result.planSource, 'claude');
  assert.equal(
    result.artifactType,
    PLAN_ARTIFACT_TYPES.CUSTOM_PAYLOAD,
  );
  assert.equal(result.payload, validPayload);
  assert.equal(result.artifact, validPayload);
  assert.equal(result.draft, null);
});

test('includes the normalized Claude plan', async () => {
  const result = await generateClaudePlanResult(
    {},
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration(),
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.equal(result.normalizedPlan, normalizedPlan);
});

test('copies only allowed Claude metadata fields', async () => {
  const result = await generateClaudePlanResult(
    {},
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration({
        profile: { userId: 1 },
        bodyImages: ['private-image'],
      }),
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.deepEqual(result.metadata, {
    model: 'claude-test',
    usedImages: 2,
    attemptsUsed: 1,
    requestTimeoutMs: 30000,
    generatedAt: '2026-08-29T10:00:00.000Z',
  });
});

test('rejects when Claude returns no plan', async () => {
  await assert.rejects(
    () => generateClaudePlanResult(
      {},
      {
        generateTwoMonthPlanWithClaude: async () => ({
          model: 'claude-test',
        }),
        buildCustomProgramPayloadFromClaudePlan: () => validPayload,
      },
    ),
    /Claude provider returned no normalized plan/,
  );
});

test('propagates a Claude generation error', async () => {
  const error = new Error('Claude failed');

  await assert.rejects(
    () => generateClaudePlanResult(
      {},
      {
        generateTwoMonthPlanWithClaude: async () => {
          throw error;
        },
        buildCustomProgramPayloadFromClaudePlan: () => validPayload,
      },
    ),
    error,
  );
});

test('does not call the payload builder after generation failure', async () => {
  let buildPayloadCalled = false;

  await assert.rejects(
    () => generateClaudePlanResult(
      {},
      {
        generateTwoMonthPlanWithClaude: async () => {
          throw new Error('Claude failed');
        },
        buildCustomProgramPayloadFromClaudePlan: () => {
          buildPayloadCalled = true;
          return validPayload;
        },
      },
    ),
  );

  assert.equal(buildPayloadCalled, false);
});

test('propagates payload conversion errors', async () => {
  const error = new Error('Payload failed');

  await assert.rejects(
    () => generateClaudePlanResult(
      {},
      {
        generateTwoMonthPlanWithClaude: async () => buildGeneration(),
        buildCustomProgramPayloadFromClaudePlan: () => {
          throw error;
        },
      },
    ),
    error,
  );
});

test('does not persist anything or require a database connection', async () => {
  let generatorCalled = false;

  const result = await generateClaudePlanResult(
    {},
    {
      generateTwoMonthPlanWithClaude: async () => {
        generatorCalled = true;
        return buildGeneration();
      },
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.equal(generatorCalled, true);
  assert.equal(result.provider, 'claude');
});

test('does not expose profile, body images or onboarding answers in metadata', async () => {
  const result = await generateClaudePlanResult(
    {
      profile: {
        userId: 10,
        onboardingFields: {
          motivation: 'private',
        },
      },
      bodyImages: ['private-image'],
    },
    {
      generateTwoMonthPlanWithClaude: async () => buildGeneration(),
      buildCustomProgramPayloadFromClaudePlan: () => validPayload,
    },
  );

  assert.equal('profile' in result.metadata, false);
  assert.equal('bodyImages' in result.metadata, false);
  assert.equal('onboardingFields' in result.metadata, false);
  assert.equal('userId' in result.metadata, false);
});
