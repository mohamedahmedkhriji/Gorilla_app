import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNutritionSafetyDecision,
  normalizeNutritionHealthProfile,
} from './nutritionSafetyEngine.js';

test('nutrition profile keeps no known condition exclusive', () => {
  const profile = normalizeNutritionHealthProfile({
    noKnownCondition: true,
    conditions: {
      diabetes: { enabled: true, type: 'type2' },
      hypertension: true,
    },
  });

  assert.equal(profile.noKnownCondition, true);
  assert.deepEqual(profile.conditions, {});
});

test('nutrition profile supports prefer not to say without forcing disclosure', () => {
  const profile = normalizeNutritionHealthProfile({
    preferNotToSay: true,
    allergies: ['peanuts'],
  });

  assert.equal(profile.preferNotToSay, true);
  assert.deepEqual(profile.conditions, {});
  assert.deepEqual(profile.allergies, ['peanuts']);
});

test('kidney condition restricts high protein personalization', () => {
  const safety = buildNutritionSafetyDecision({
    healthProfile: {
      conditions: {
        kidneyDisease: { enabled: true, clinicianNutritionPlan: false },
      },
    },
    targets: { targetProtein: 190 },
  });

  assert.equal(safety.allowedAutomation.tracking, true);
  assert.equal(safety.allowedAutomation.mealGeneration, false);
  assert.equal(safety.restrictedAutomation.highProteinPersonalization, true);
  assert.equal(safety.clinicianPersonalizationRequired, true);
  assert.ok(safety.warnings.some((warning) => /individual guidance/i.test(warning)));
});

test('diabetes highlights carbohydrate tracking without medical advice', () => {
  const safety = buildNutritionSafetyDecision({
    healthProfile: {
      conditions: {
        diabetes: { enabled: true, type: 'type2' },
      },
    },
  });

  assert.equal(safety.allowedAutomation.tracking, true);
  assert.ok(safety.nutrientPriorities.includes('carbohydrateDistribution'));
  assert.ok(safety.warnings.some((warning) => /does not provide medication or insulin guidance/i.test(warning)));
});
