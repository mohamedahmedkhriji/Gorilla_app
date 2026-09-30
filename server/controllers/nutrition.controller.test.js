import assert from 'node:assert/strict';
import test from 'node:test';
import { createNutritionController } from './nutrition.controller.js';

const makeResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const makePool = (handler) => {
  const calls = [];
  return {
    calls,
    async execute(sql, params = []) {
      calls.push({ sql, params });
      return handler(sql, params, calls);
    },
  };
};

test('nutrition profile retrieval preserves missing profile response shape', async () => {
  const pool = makePool(async (sql) => {
    if (/FROM nutrition_health_profiles/.test(sql)) return [[]];
    if (/FROM nutrition_hydration_entries/.test(sql)) return [[{ total_ml: 500, entries_count: 2 }]];
    return [[]];
  });
  const controller = createNutritionController({ dbPool: pool });
  const res = makeResponse();

  await controller.getNutritionProfile({ authUser: { id: 42 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.completed, false);
  assert.equal(res.body.completedAt, null);
  assert.equal(res.body.healthProfile, null);
  assert.deepEqual(res.body.hydration, { loggedMl: 500, entriesCount: 2 });
  assert.equal(res.body.safety.allowedAutomation.hydrationLogging, true);
  assert.ok(pool.calls.some((call) => /WHERE user_id = \?/.test(call.sql) && call.params[0] === 42));
});

test('nutrition profile creation uses authenticated user and returns current safety shape', async () => {
  const pool = makePool(async () => [[]]);
  const controller = createNutritionController({ dbPool: pool });
  const res = makeResponse();

  await controller.saveNutritionProfile({
    authUser: { id: 7 },
    body: {
      conditions: { diabetes: { enabled: true, type: 'type2' } },
      allergies: ['peanuts'],
      completedAt: '2026-09-25T10:20:30.000Z',
    },
  }, res);

  const profileWrite = pool.calls.find((call) => /INSERT INTO nutrition_health_profiles/.test(call.sql));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.completed, true);
  assert.equal(res.body.completedAt, new Date('2026-09-25 10:20:30').toISOString());
  assert.deepEqual(res.body.healthProfile.conditions.diabetes, { enabled: true, type: 'type2' });
  assert.ok(res.body.safety.nutrientPriorities.includes('carbohydrateDistribution'));
  assert.equal(profileWrite.params[0], 7);
  assert.equal(profileWrite.params[1], JSON.stringify({ diabetes: { enabled: true, type: 'type2' } }));
  assert.equal(profileWrite.params[8], '2026-09-25 10:20:30');
});

test('hydration logging preserves validation, drink normalization, totals, and response shape', async () => {
  const pool = makePool(async (sql) => {
    if (/FROM nutrition_hydration_entries/.test(sql)) return [[{ total_ml: 750, entries_count: 3 }]];
    return [[]];
  });
  const controller = createNutritionController({ dbPool: pool });
  const invalidRes = makeResponse();
  const validRes = makeResponse();

  await controller.addHydration({ authUser: { id: 4 }, body: { amountMl: -1 } }, invalidRes);
  await controller.addHydration({
    authUser: { id: 4 },
    body: { amount_ml: 250.4, drink_type: 'sparkling' },
  }, validRes);

  const insert = pool.calls.find((call) => /INSERT INTO nutrition_hydration_entries/.test(call.sql));
  assert.equal(invalidRes.statusCode, 400);
  assert.deepEqual(invalidRes.body, { error: 'Hydration amount must be greater than 0 ml' });
  assert.equal(validRes.statusCode, 200);
  assert.deepEqual(validRes.body, {
    success: true,
    amountMl: 250,
    drinkType: 'water',
    hydration: { loggedMl: 750, entriesCount: 3 },
  });
  assert.deepEqual(insert.params, [4, 250, 'water']);
});

test('daily nutrition plan preserves planner output and safety wrapper', async () => {
  const pool = makePool(async (sql) => {
    if (/FROM nutrition_health_profiles/.test(sql)) {
      return [[{
        conditions_json: JSON.stringify({ kidneyDisease: { enabled: true, clinicianNutritionPlan: false } }),
        allergies_json: JSON.stringify(['shellfish']),
        intolerances_json: JSON.stringify([]),
        clinician_nutrition_plan: null,
        prefer_not_to_say: 0,
        no_known_condition: 0,
        onboarding_version: 1,
        completed_at: '2026-09-25 10:20:30',
      }]];
    }
    return [[]];
  });
  const controller = createNutritionController({
    dbPool: pool,
    dailyNutritionPlanGenerator: async () => ({
      targets: { calories: 2200, protein: 170 },
      meals: [{ name: 'Breakfast' }],
      hydration: { recommendedWaterMl: 2500 },
    }),
  });
  const res = makeResponse();

  await controller.getDailyNutritionPlan({
    authUser: { id: 5 },
    body: { targetCalories: 2200, targetProtein: 190, targetWaterMl: 2500 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.targets.calories, 2200);
  assert.deepEqual(res.body.meals, [{ name: 'Breakfast' }]);
  assert.equal(res.body.safety.allowedAutomation.mealGeneration, false);
  assert.equal(res.body.safety.restrictedAutomation.highProteinPersonalization, true);
  assert.deepEqual(res.body.safety.mealFilters.allergies, ['shellfish']);
  assert.deepEqual(pool.calls.find((call) => /FROM nutrition_health_profiles/.test(call.sql)).params, [5]);
});
