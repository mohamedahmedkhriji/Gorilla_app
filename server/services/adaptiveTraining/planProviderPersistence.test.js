import assert from 'node:assert/strict';
import test from 'node:test';

import {
  persistPlanProviderResult,
  PlanProviderPersistenceError,
} from './planProviderPersistence.js';
import {
  PLAN_ARTIFACT_TYPES,
} from './planProviderResult.js';

const conn = {};

const rulesResult = {
  provider: 'rules',
  planSource: 'repset_rules',
  artifactType: PLAN_ARTIFACT_TYPES.RULES_DRAFT,
  draft: { planName: 'Test Draft' },
  payload: null,
  normalizedPlan: null,
  metadata: { engine: 'test' },
  warnings: [],
};

const customResult = {
  provider: 'claude',
  planSource: 'claude',
  artifactType: PLAN_ARTIFACT_TYPES.CUSTOM_PAYLOAD,
  draft: null,
  payload: { planName: 'Custom Payload' },
  normalizedPlan: { planName: 'Normalized' },
  metadata: { model: 'test' },
  warnings: ['low confidence'],
};

test('rules_draft calls persistRulesDraft with the correct draft and user', async () => {
  let receivedConn;
  let receivedInput;

  const result = await persistPlanProviderResult(
    conn,
    rulesResult,
    {
      userId: '7',
      gymId: 3,
      notes: 'Coach note',
    },
    {
      persistRulesDraft: async (nextConn, input) => {
        receivedConn = nextConn;
        receivedInput = input;
        return {
          programId: 123,
          name: 'Test Draft',
        };
      },
    },
  );

  assert.equal(receivedConn, conn);
  assert.deepEqual(receivedInput, {
    userId: 7,
    gymId: 3,
    notes: 'Coach note',
    programDraft: rulesResult.draft,
  });
  assert.deepEqual(result, {
    provider: 'rules',
    planSource: 'repset_rules',
    artifactType: PLAN_ARTIFACT_TYPES.RULES_DRAFT,
    program: {
      programId: 123,
      name: 'Test Draft',
    },
    normalizedPlan: null,
    metadata: { engine: 'test' },
    warnings: [],
  });
});

test('custom_payload calls the injected custom persister', async () => {
  let receivedInput;

  const result = await persistPlanProviderResult(
    conn,
    customResult,
    {
      userId: 9,
      gymId: null,
      notes: 'Custom note',
    },
    {
      persistCustomPayload: async (input) => {
        receivedInput = input;
        return {
          programId: 456,
          name: 'Custom Payload',
        };
      },
    },
  );

  assert.deepEqual(receivedInput, {
    conn,
    userId: 9,
    gymId: null,
    notes: 'Custom note',
    payload: customResult.payload,
    providerResult: customResult,
  });
  assert.equal(result.provider, 'claude');
  assert.equal(result.planSource, 'claude');
  assert.equal(
    result.artifactType,
    PLAN_ARTIFACT_TYPES.CUSTOM_PAYLOAD,
  );
  assert.deepEqual(result.program, {
    programId: 456,
    name: 'Custom Payload',
  });
  assert.equal(result.normalizedPlan, customResult.normalizedPlan);
  assert.deepEqual(result.metadata, customResult.metadata);
  assert.deepEqual(result.warnings, customResult.warnings);
});

test('custom payload without a persister throws', async () => {
  await assert.rejects(
    () => persistPlanProviderResult(
      conn,
      customResult,
      { userId: 1 },
    ),
    PlanProviderPersistenceError,
  );
});

test('unsupported artifact type throws', async () => {
  await assert.rejects(
    () => persistPlanProviderResult(
      conn,
      {
        ...rulesResult,
        artifactType: 'unknown',
      },
      { userId: 1 },
    ),
    PlanProviderPersistenceError,
  );
});

test('missing connection throws', async () => {
  await assert.rejects(
    () => persistPlanProviderResult(
      null,
      rulesResult,
      { userId: 1 },
    ),
    PlanProviderPersistenceError,
  );
});

test('missing or invalid userId throws', async () => {
  await assert.rejects(
    () => persistPlanProviderResult(
      conn,
      rulesResult,
      {},
    ),
    PlanProviderPersistenceError,
  );

  await assert.rejects(
    () => persistPlanProviderResult(
      conn,
      rulesResult,
      { userId: 'abc' },
    ),
    PlanProviderPersistenceError,
  );
});
