import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAdaptiveTrainingConfig,
} from './adaptiveTrainingConfig.js';

import {
  PLAN_PROVIDERS,
  resolvePlanProviderOrder,
} from './planProviderPolicy.js';

test('preserves current production order in legacy mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'legacy',
  });

  const order = resolvePlanProviderOrder({
    config,
    claudeAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.CLAUDE,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});

test('uses rules first and Claude as fallback in rules mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'rules',
  });

  const order = resolvePlanProviderOrder({
    config,
    rulesAllowed: true,
    claudeAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.RULES,
    PLAN_PROVIDERS.CLAUDE,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});

test('skips Claude when fallback is disabled', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'rules',
    CLAUDE_PLAN_FALLBACK_ENABLED: 'false',
  });

  const order = resolvePlanProviderOrder({
    config,
    rulesAllowed: true,
    claudeAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.RULES,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});

test('uses Claude first in Claude mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'claude',
  });

  const order = resolvePlanProviderOrder({
    config,
    claudeAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.CLAUDE,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});

test('allows an explicit rules fallback in Claude mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'claude',
    ADAPTIVE_TRAINING_RULES_ENABLED: 'true',
  });

  const order = resolvePlanProviderOrder({
    config,
    rulesAllowed: true,
    claudeAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.CLAUDE,
    PLAN_PROVIDERS.RULES,
    PLAN_PROVIDERS.TEMPLATE_LIBRARY,
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});

test('skips providers that are not allowed', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'auto',
  });

  const order = resolvePlanProviderOrder({
    config,
    rulesAllowed: false,
    claudeAllowed: false,
    templateLibraryAllowed: false,
    legacyRulesAllowed: true,
  });

  assert.deepEqual(order, [
    PLAN_PROVIDERS.LEGACY_RULES,
  ]);
});
