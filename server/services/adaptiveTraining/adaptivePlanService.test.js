import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateAndPersistAdaptivePlan,
} from './adaptivePlanService.js';
import {
  executePlanProviderOrder,
} from './planProviderOrchestrator.js';

const buildProviderResult = (
  metadata = { engine: 'test' },
) => ({
  provider: 'rules',
  planSource: 'repset_rules',
  artifactType: 'rules_draft',
  draft: {
    planName: 'Rules Draft',
  },
  payload: null,
  normalizedPlan: null,
  metadata,
  warnings: [],
});

const buildSuccessDependencies = ({
  providerResult = buildProviderResult(),
  persistedProgram = {
    programId: 123,
    name: 'Rules Draft',
  },
  attempts = [
    {
      provider: 'rules',
      status: 'success',
    },
  ],
} = {}) => {
  const calls = {
    rules: [],
    orchestrator: [],
    persistence: [],
  };

  const dependencies = {
    executePlanProviderOrder: async (input) => {
      calls.orchestrator.push(input);
      const result =
        await input.handlers.rules(input.context);

      return {
        result,
        attempts,
        failures: [],
      };
    },
    generateRulesPlanResult: async (
      conn,
      options,
    ) => {
      calls.rules.push({
        conn,
        options,
      });

      return providerResult;
    },
    persistPlanProviderResult: async (
      conn,
      nextProviderResult,
      persistenceOptions,
    ) => {
      calls.persistence.push({
        conn,
        providerResult: nextProviderResult,
        options: persistenceOptions,
      });

      return {
        provider: nextProviderResult.provider,
        planSource: nextProviderResult.planSource,
        program: persistedProgram,
      };
    },
  };

  return {
    calls,
    dependencies,
    providerResult,
    persistedProgram,
    attempts,
  };
};

test('missing connection is rejected', async () => {
  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      null,
      { userId: 1 },
    ),
    TypeError,
  );
});

test('missing userId is rejected', async () => {
  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      {},
    ),
    TypeError,
  );
});

test('zero userId is rejected', async () => {
  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: 0 },
    ),
    TypeError,
  );
});

test('negative userId is rejected', async () => {
  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: -1 },
    ),
    TypeError,
  );
});

test('non-integer userId is rejected', async () => {
  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: 1.5 },
    ),
    TypeError,
  );
});

test('rules provider receives the same connection and options', async () => {
  const conn = {};
  const options = {
    userId: 7,
    goal: 'muscle_gain',
    daysPerWeek: 4,
  };
  const {
    calls,
    dependencies,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    conn,
    options,
    dependencies,
  );

  assert.equal(calls.rules[0].conn, conn);
  assert.equal(calls.rules[0].options, options);
});

test('orchestrator receives only the rules provider order', async () => {
  const {
    calls,
    dependencies,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    {},
    { userId: 1 },
    dependencies,
  );

  assert.deepEqual(
    calls.orchestrator[0].order,
    ['rules'],
  );
  assert.deepEqual(
    Object.keys(calls.orchestrator[0].handlers),
    ['rules'],
  );
});

test('an injected Claude function is never called', async () => {
  let claudeCalled = false;
  const {
    dependencies,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    {},
    { userId: 1 },
    {
      ...dependencies,
      generateClaudePlanResult: async () => {
        claudeCalled = true;
      },
    },
  );

  assert.equal(claudeCalled, false);
});

test('successful orchestration result is passed to persistence', async () => {
  const {
    calls,
    dependencies,
    providerResult,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    {},
    { userId: 1 },
    dependencies,
  );

  assert.equal(
    calls.persistence[0].providerResult,
    providerResult,
  );
});

test('persistence receives userId, gymId and notes', async () => {
  const {
    calls,
    dependencies,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    {},
    {
      userId: '12',
      gymId: 4,
      notes: 'Coach note',
    },
    dependencies,
  );

  assert.deepEqual(calls.persistence[0].options, {
    userId: 12,
    gymId: 4,
    notes: 'Coach note',
  });
});

test('returned provider is rules', async () => {
  const {
    dependencies,
  } = buildSuccessDependencies();

  const result =
    await generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      dependencies,
    );

  assert.equal(result.provider, 'rules');
});

test('returned plan source is repset_rules', async () => {
  const {
    dependencies,
  } = buildSuccessDependencies();

  const result =
    await generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      dependencies,
    );

  assert.equal(result.planSource, 'repset_rules');
});

test('persisted program is returned', async () => {
  const {
    dependencies,
    persistedProgram,
  } = buildSuccessDependencies();

  const result =
    await generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      dependencies,
    );

  assert.equal(
    result.persistedProgram,
    persistedProgram,
  );
});

test('provider attempts are preserved', async () => {
  const attempts = [
    {
      provider: 'rules',
      status: 'success',
    },
  ];
  const {
    dependencies,
  } = buildSuccessDependencies({
    attempts,
  });

  const result =
    await generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      dependencies,
    );

  assert.equal(result.attempts, attempts);
});

test('rules-generation errors propagate', async () => {
  const error = new Error('Rules failed');

  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      {
        executePlanProviderOrder,
        generateRulesPlanResult: async () => {
          throw error;
        },
        persistPlanProviderResult: async () => {
          throw new Error('Should not persist');
        },
      },
    ),
    /Rules failed/,
  );
});

test('persistence is not called after generation failure', async () => {
  let persistCalled = false;

  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      {
        executePlanProviderOrder,
        generateRulesPlanResult: async () => {
          throw new Error('Rules failed');
        },
        persistPlanProviderResult: async () => {
          persistCalled = true;
        },
      },
    ),
  );

  assert.equal(persistCalled, false);
});

test('persistence errors propagate', async () => {
  const error = new Error('Persistence failed');
  const {
    dependencies,
  } = buildSuccessDependencies();

  await assert.rejects(
    () => generateAndPersistAdaptivePlan(
      {},
      { userId: 1 },
      {
        ...dependencies,
        persistPlanProviderResult: async () => {
          throw error;
        },
      },
    ),
    error,
  );
});

test('no transaction methods are called', async () => {
  const calls = {
    beginTransaction: 0,
    commit: 0,
    rollback: 0,
  };
  const conn = {
    beginTransaction: async () => {
      calls.beginTransaction += 1;
    },
    commit: async () => {
      calls.commit += 1;
    },
    rollback: async () => {
      calls.rollback += 1;
    },
  };
  const {
    dependencies,
  } = buildSuccessDependencies();

  await generateAndPersistAdaptivePlan(
    conn,
    { userId: 1 },
    dependencies,
  );

  assert.deepEqual(calls, {
    beginTransaction: 0,
    commit: 0,
    rollback: 0,
  });
});

test('private profile information is not copied into metadata', async () => {
  const {
    dependencies,
  } = buildSuccessDependencies();

  const result =
    await generateAndPersistAdaptivePlan(
      {},
      {
        userId: 1,
        profile: {
          email: 'private@example.com',
        },
        bodyImages: ['base64-image'],
        onboardingAnswers: {
          injuryHistory: 'private',
        },
      },
      dependencies,
    );

  assert.deepEqual(result.providerResult.metadata, {
    engine: 'test',
  });
  assert.equal(
    'profile' in result.providerResult.metadata,
    false,
  );
  assert.equal(
    'bodyImages' in result.providerResult.metadata,
    false,
  );
  assert.equal(
    'onboardingAnswers' in result.providerResult.metadata,
    false,
  );
});
