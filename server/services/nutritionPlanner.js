/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATASET_FILE = path.join(ROOT_DIR, 'dataset', 'daily_food_nutrition_dataset.csv');

const cache = {
  foods: null,
  loadedAt: null,
};

const SLOT_CONFIG = [
  { slot: 'Breakfast', mealType: 'Breakfast', portion: 0.24 },
  { slot: 'Lunch', mealType: 'Lunch', portion: 0.30 },
  { slot: 'Dinner', mealType: 'Dinner', portion: 0.30 },
  { slot: 'Snack', mealType: 'Snack', portion: 0.08 },
  { slot: 'Snack', mealType: 'Snack', portion: 0.08 },
];

const toKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseCsvRow = (line) => {
  const row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  return row.map((cell) => String(cell ?? '').trim());
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round1 = (value) => Number(Number(value || 0).toFixed(1));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeGoal = (goal) =>
  String(goal || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();

const normalizeMealType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('break')) return 'Breakfast';
  if (normalized.includes('lunch')) return 'Lunch';
  if (normalized.includes('dinner')) return 'Dinner';
  if (normalized.includes('snack')) return 'Snack';
  return 'Other';
};

const categoryFlags = (category = '') => {
  const normalized = String(category || '').toLowerCase();
  return {
    processed: /(processed|dessert|soda|fries|pizza|burger|fast)/.test(normalized),
    proteinFocused: /(protein|fish|meat|dairy|supplement|legume)/.test(normalized),
  };
};

const sumItems = (items = []) => {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      fiber: acc.fiber + Number(item.fiber || 0),
      sugars: acc.sugars + Number(item.sugars || 0),
      sodium: acc.sodium + Number(item.sodium || 0),
      cholesterol: acc.cholesterol + Number(item.cholesterol || 0),
      waterMl: acc.waterMl + Number(item.waterMl || 0),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugars: 0,
      sodium: 0,
      cholesterol: 0,
      waterMl: 0,
    },
  );

  return {
    calories: round1(totals.calories),
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
    fiber: round1(totals.fiber),
    sugars: round1(totals.sugars),
    sodium: round1(totals.sodium),
    cholesterol: round1(totals.cholesterol),
    waterMl: round1(totals.waterMl),
  };
};

const getGoalPenalty = (food, goal) => {
  const flags = categoryFlags(food.category);
  const sugarPenalty = Number(food.sugars || 0) * 0.7;
  const processedPenalty = flags.processed ? 35 : 0;
  const sodiumPenalty = Number(food.sodium || 0) > 900 ? 25 : 0;

  if (goal.includes('fat') || goal.includes('loss') || goal.includes('cut')) {
    return (food.calories > 450 ? 35 : 0) + sugarPenalty + processedPenalty + sodiumPenalty - (food.protein * 1.5) - (food.fiber * 1.2);
  }

  if (goal.includes('muscle') || goal.includes('gain') || goal.includes('hypertrophy') || goal.includes('strength')) {
    return (food.calories < 120 ? 12 : 0) + processedPenalty + (sugarPenalty * 0.4) - (food.protein * 2.1);
  }

  if (goal.includes('endurance')) {
    return processedPenalty + (sugarPenalty * 0.6) - (food.carbs * 0.7) - (food.protein * 1.2);
  }

  return processedPenalty + (sugarPenalty * 0.5) - (food.protein * 1.4) - (food.fiber * 0.8);
};

const scoreFoodForSlot = ({ food, targetCalories, remainingCalories, goal }) => {
  const calorieGap = Math.abs(food.calories - targetCalories);
  const overBudgetPenalty = food.calories > remainingCalories + 150 ? 120 : 0;
  const coreScore = (calorieGap * 1.2) - (food.protein * 1.5) - (food.fiber * 0.7);
  return coreScore + overBudgetPenalty + getGoalPenalty(food, goal);
};

const selectBestFood = ({ candidates, usedCounts, targetCalories, remainingCalories, goal }) => {
  const ranked = candidates
    .map((food) => ({
      food,
      usedCount: Number(usedCounts.get(food.name) || 0),
      score: scoreFoodForSlot({ food, targetCalories, remainingCalories, goal }),
    }))
    .sort((a, b) => {
      if (a.usedCount !== b.usedCount) return a.usedCount - b.usedCount;
      return a.score - b.score;
    });

  return ranked.length ? ranked[0].food : null;
};

const loadFoodDataset = ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && Array.isArray(cache.foods) && cache.foods.length) {
    return {
      foods: cache.foods,
      loadedAt: cache.loadedAt,
      source: path.basename(DATASET_FILE),
    };
  }

  if (!fs.existsSync(DATASET_FILE)) {
    throw new Error(`Missing dataset file: ${DATASET_FILE}`);
  }

  const raw = fs.readFileSync(DATASET_FILE, 'utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Food nutrition dataset is empty.');
  }

  const header = parseCsvRow(lines[0]).map(toKey);
  const foods = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parsed = parseCsvRow(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = parsed[j] ?? '';
    }

    const food = {
      name: String(row.food_item || '').trim(),
      category: String(row.category || '').trim(),
      mealType: normalizeMealType(row.meal_type),
      calories: toNumber(row.calories_kcal, 0),
      protein: toNumber(row.protein_g, 0),
      carbs: toNumber(row.carbohydrates_g, 0),
      fat: toNumber(row.fat_g, 0),
      fiber: toNumber(row.fiber_g, 0),
      sugars: toNumber(row.sugars_g, 0),
      sodium: toNumber(row.sodium_mg, 0),
      cholesterol: toNumber(row.cholesterol_mg, 0),
      waterMl: toNumber(row.water_intake_ml, 0),
    };

    if (!food.name || food.calories <= 0) continue;
    foods.push(food);
  }

  cache.foods = foods;
  cache.loadedAt = new Date().toISOString();

  return {
    foods,
    loadedAt: cache.loadedAt,
    source: path.basename(DATASET_FILE),
  };
};

const getTargets = (input = {}) => {
  const targetCalories = clamp(toNumber(input.targetCalories, 2200), 1200, 5000);
  const targetProtein = clamp(toNumber(input.targetProtein, 140), 55, 360);
  const targetFat = clamp(toNumber(input.targetFat, Math.round((targetCalories * 0.27) / 9)), 30, 200);
  const targetCarbs = clamp(
    toNumber(input.targetCarbs, Math.max(50, Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4))),
    50,
    700,
  );
  const targetWaterMl = clamp(toNumber(input.targetWaterMl, 3000), 1500, 8000);
  return {
    targetCalories: Math.round(targetCalories),
    targetProtein: Math.round(targetProtein),
    targetCarbs: Math.round(targetCarbs),
    targetFat: Math.round(targetFat),
    targetWaterMl: Math.round(targetWaterMl),
  };
};

export const generateDailyNutritionPlan = async (input = {}) => {
  const { foods, loadedAt, source } = loadFoodDataset({ forceRefresh: Boolean(input.forceRefresh) });
  const targets = getTargets(input);
  const goal = normalizeGoal(input.goal);

  const usedCounts = new Map();
  const meals = [];
  let remainingCalories = targets.targetCalories;

  SLOT_CONFIG.forEach((slotConfig) => {
    const candidates = foods.filter((food) => food.mealType === slotConfig.mealType);
    const pool = candidates.length ? candidates : foods;
    const targetCalories = Math.max(120, Math.round(targets.targetCalories * slotConfig.portion));
    const selected = selectBestFood({
      candidates: pool,
      usedCounts,
      targetCalories,
      remainingCalories,
      goal,
    });

    if (!selected) return;

    const prevCount = Number(usedCounts.get(selected.name) || 0);
    usedCounts.set(selected.name, prevCount + 1);

    remainingCalories = Math.max(0, remainingCalories - selected.calories);

    meals.push({
      slot: slotConfig.slot,
      items: [selected],
      totals: sumItems([selected]),
    });
  });

  const allSelectedItems = meals.flatMap((meal) => meal.items);
  let totals = sumItems(allSelectedItems);

  const proteinDeficit = targets.targetProtein - totals.protein;
  const calorieDeficit = targets.targetCalories - totals.calories;

  if (proteinDeficit > 12 || calorieDeficit > 180) {
    const topUpPool = foods.filter((food) => (
      food.mealType === 'Snack' || categoryFlags(food.category).proteinFocused
    ));

    let attempts = 0;
    while (attempts < 3) {
      totals = sumItems(meals.flatMap((meal) => meal.items));
      const missingProtein = targets.targetProtein - totals.protein;
      const missingCalories = targets.targetCalories - totals.calories;
      if (missingProtein <= 12 && missingCalories <= 180) break;

      const targetTopUpCalories = clamp(Math.round(missingCalories * 0.55), 90, 320);
      const bestTopUp = selectBestFood({
        candidates: topUpPool.length ? topUpPool : foods,
        usedCounts,
        targetCalories: targetTopUpCalories,
        remainingCalories: Math.max(0, missingCalories),
        goal,
      });

      if (!bestTopUp) break;

      const prevCount = Number(usedCounts.get(bestTopUp.name) || 0);
      usedCounts.set(bestTopUp.name, prevCount + 1);

      let snackMeal = meals.find((meal) => meal.slot === 'Snack');
      if (!snackMeal) {
        snackMeal = { slot: 'Snack', items: [], totals: sumItems([]) };
        meals.push(snackMeal);
      }
      snackMeal.items.push(bestTopUp);
      snackMeal.totals = sumItems(snackMeal.items);
      attempts += 1;
    }
  }

  const normalizedMeals = meals.map((meal) => ({
    slot: meal.slot,
    items: meal.items,
    totals: sumItems(meal.items),
  }));

  const finalTotals = sumItems(normalizedMeals.flatMap((meal) => meal.items));
  const waterFromFoodsMl = Math.round(finalTotals.waterMl);
  const remainingWaterMl = Math.max(0, targets.targetWaterMl - waterFromFoodsMl);

  return {
    generatedAt: new Date().toISOString(),
    sourceDataset: source,
    sourceLoadedAt: loadedAt,
    goal: goal || 'general fitness',
    targets: {
      calories: targets.targetCalories,
      protein: targets.targetProtein,
      carbs: targets.targetCarbs,
      fat: targets.targetFat,
      waterMl: targets.targetWaterMl,
    },
    totals: {
      calories: finalTotals.calories,
      protein: finalTotals.protein,
      carbs: finalTotals.carbs,
      fat: finalTotals.fat,
      fiber: finalTotals.fiber,
      sugars: finalTotals.sugars,
      sodium: finalTotals.sodium,
      cholesterol: finalTotals.cholesterol,
    },
    hydration: {
      recommendedWaterMl: targets.targetWaterMl,
      waterFromFoodsMl,
      remainingWaterMl,
    },
    meals: normalizedMeals,
    notes: [
      'Personalized coaching estimate generated from synthetic food dataset and your current targets.',
      'Adjust meals weekly based on adherence, recovery, and progress trends.',
    ],
  };
};

