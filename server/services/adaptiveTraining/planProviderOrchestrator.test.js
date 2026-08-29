import assert from 'node:assert/strict';
import test from 'node:test';

import {
  executePlanProviderOrder,
} from './planProviderOrchestrator.js';

test('returns the first successful provider', async () => {
  const result = await executePlanProviderOrder({
    order: ['rules', 'claude'],
    handlers: {
      rules: async () => ({
        provider: 'rules',
        planSource: 'repset_rules',
      }),
      claude: async () => {
        throw new Error('Should not run');
      },
    },
  });

  assert.equal(result.result.provider, 'rules');
  assert.deepEqual(result.attempts, [
    {
      provider: 'rules',
      status: 'success',
    },
  ]);
  assert.deepEqual(result.failures, []);
});

test('falls back after the first provider throws', async () => {
  const result = await executePlanProviderOrder({
    order: ['rules', 'claude'],
    handlers: {
      rules: async () => {
        throw new Error('Rules failed');
      },
      claude: async () => ({
        provider: 'claude',
        planSource: 'claude',
      }),
    },
  });

  assert.equal(result.result.provider, 'claude');
  assert.deepEqual(result.attempts, [
    {
      provider: 'rules',
      status: 'failed',
    },
    {
      provider: 'claude',
      status: 'success',
    },
  ]);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].provider, 'rules');
  assert.equal(result.failures[0].message, 'Rules failed');
});

test('skips providers without handlers', async () => {
  const result = await executePlanProviderOrder({
    order: ['rules', 'template_library'],
    handlers: {
      template_library: async () => ({
        provider: 'template_library',
        planSource: 'template_library',
      }),
    },
  });

  assert.equal(result.result.provider, 'template_library');
  assert.deepEqual(result.attempts, [
    {
      provider: 'rules',
      status: 'unavailable',
    },
    {
      provider: 'template_library',
      status: 'success',
    },
  ]);
  assert.deepEqual(result.failures, []);
});

test('rejects a mismatched result provider and continues', async () => {
  let claudeRan = false;

  const result = await executePlanProviderOrder({
    order: ['rules', 'claude'],
    handlers: {
      rules: async () => ({
        provider: 'claude',
        planSource: 'claude',
      }),
      claude: async () => {
        claudeRan = true;
        return {
          provider: 'claude',
          planSource: 'claude',
        };
      },
    },
  });

  assert.equal(claudeRan, true);
  assert.equal(result.result.provider, 'claude');
  assert.deepEqual(result.attempts, [
    {
      provider: 'rules',
      status: 'failed',
    },
    {
      provider: 'claude',
      status: 'success',
    },
  ]);
  assert.equal(result.failures.length, 1);
  assert.match(
    result.failures[0].message,
    /Provider mismatch/,
  );
});

test('returns null result when every provider fails', async () => {
  const result = await executePlanProviderOrder({
    order: ['rules', 'claude'],
    handlers: {
      rules: async () => {
        throw new Error('Rules failed');
      },
      claude: async () => null,
    },
  });

  assert.equal(result.result, null);
  assert.deepEqual(result.attempts, [
    {
      provider: 'rules',
      status: 'failed',
    },
    {
      provider: 'claude',
      status: 'failed',
    },
  ]);
  assert.equal(result.failures.length, 2);
  assert.equal(
    result.failures[1].message,
    'Provider returned no result',
  );
});

test('rejects a non-array order', async () => {
  await assert.rejects(
    () => executePlanProviderOrder({
      order: 'rules',
    }),
    TypeError,
  );
});

test('passes the same context to the provider handler', async () => {
  const context = {
    userId: 1,
    goal: 'muscle_gain',
  };
  let receivedContext;

  await executePlanProviderOrder({
    order: ['rules'],
    context,
    handlers: {
      rules: async (nextContext) => {
        receivedContext = nextContext;
        return {
          provider: 'rules',
          planSource: 'repset_rules',
        };
      },
    },
  });

  assert.equal(receivedContext, context);
});
