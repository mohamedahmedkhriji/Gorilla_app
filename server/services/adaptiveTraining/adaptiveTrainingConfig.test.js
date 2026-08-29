import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAN_PROVIDER_MODES,
  parseEnvironmentBoolean,
  resolveAdaptiveTrainingConfig,
} from './adaptiveTrainingConfig.js';

test('defaults to legacy mode without changing production behavior', () => {
  const config = resolveAdaptiveTrainingConfig({});

  assert.deepEqual(config, {
    mode: PLAN_PROVIDER_MODES.LEGACY,
    rulesEnabled: false,
    claudeFallbackEnabled: true,
    shadowMode: true,
  });
});

test('enables rules automatically in rules mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'rules',
  });

  assert.equal(config.mode, PLAN_PROVIDER_MODES.RULES);
  assert.equal(config.rulesEnabled, true);
});

test('enables rules automatically in auto mode', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'AUTO',
  });

  assert.equal(config.mode, PLAN_PROVIDER_MODES.AUTO);
  assert.equal(config.rulesEnabled, true);
});

test('falls back safely for an unsupported provider', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'unknown-provider',
  });

  assert.equal(config.mode, PLAN_PROVIDER_MODES.LEGACY);
  assert.equal(config.rulesEnabled, false);
});

test('explicit flags override their defaults', () => {
  const config = resolveAdaptiveTrainingConfig({
    PLAN_PROVIDER: 'rules',
    ADAPTIVE_TRAINING_RULES_ENABLED: 'false',
    CLAUDE_PLAN_FALLBACK_ENABLED: '0',
    ADAPTIVE_TRAINING_SHADOW_MODE: 'no',
  });

  assert.equal(config.rulesEnabled, false);
  assert.equal(config.claudeFallbackEnabled, false);
  assert.equal(config.shadowMode, false);
});

test('parses common environment boolean values', () => {
  assert.equal(parseEnvironmentBoolean('yes'), true);
  assert.equal(parseEnvironmentBoolean('OFF'), false);
  assert.equal(parseEnvironmentBoolean(undefined, true), true);
});
