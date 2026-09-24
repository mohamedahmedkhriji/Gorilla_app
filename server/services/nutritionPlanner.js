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

const stripServingFromName = (value = '') =>
  String(value || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const estimateServingGrams = (name = '', category = '') => {
  const text = `${name} ${category}`.toLowerCase();
  const ozMatch = text.match(/(\d+(?:\.\d+)?)\s*oz/);
  if (ozMatch) return Math.round(Number(ozMatch[1]) * 28.35);

  const cupMatch = text.match(/(\d+(?:\.\d+)?)\s*cup/);
  if (cupMatch) return Math.round(Number(cupMatch[1]) * 180);

  const tbspMatch = text.match(/(\d+(?:\.\d+)?)\s*tbsp/);
  if (tbspMatch) return Math.round(Number(tbspMatch[1]) * 14);

  const tspMatch = text.match(/(\d+(?:\.\d+)?)\s*tsp/);
  if (tspMatch) return Math.round(Number(tspMatch[1]) * 5);

  if (/slice|waffle|pancake|toast|bread/.test(text)) return 35;
  if (/bar|muffin|cookie|donut|croissant|danish/.test(text)) return 75;
  if (/soup|stew|chili|pasta|rice bowl|salad|sandwich|wrap|burger|pizza|meal/.test(text)) return 300;
  if (/beverage|coffee|tea|juice|soda|water|latte|milk/.test(text)) return 240;
  if (/condiment|sauce|oil|butter|dressing|syrup|honey/.test(text)) return 15;
  if (/fruit|vegetable/.test(text)) return 120;
  if (/protein|fish|meat|dairy|legume|tofu|tempeh|seitan|egg/.test(text)) return 100;
  if (/grain|rice|oat|pasta|potato|bread/.test(text)) return 150;
  if (/nut|seed/.test(text)) return 28;
  return 100;
};

const classifyFood = (food) => {
  const text = `${food.name} ${food.category}`.toLowerCase();
  const category = String(food.category || '').toLowerCase();
  const flags = categoryFlags(food.category);
  let role = 'mixed';

  const isCompositeMeal = /^meal\b/.test(category);
  const isBeverage = /beverage|coffee|tea|soda|juice|latte|beer|wine|cocktail|kombucha|lassi|horchata/.test(text);
  const isCondiment = /condiment|sauce|oil|butter|dressing|syrup|honey|mayo|aioli|pesto|salt|pepper|spice|paste|glaze|chutney/.test(text);

  if (isBeverage) role = 'beverage';
  else if (isCondiment) role = /oil|butter|dressing|mayo|aioli|tahini|pesto|nuts|seeds/.test(text) ? 'fat' : 'condiment';
  else if (isCompositeMeal) role = 'mixed';
  else if (/vegetable|fruit|broccoli|spinach|asparagus|green beans|bell pepper|cucumber|tomato|greens|slaw|carrot|kale|bok choy|lettuce|cabbage|peas|berries|orange|grapes|pear|mango|kiwi|dates|watermelon|papaya|guava|apple|banana/.test(text)) role = 'produce';
  else if (/protein|fish|meat|chicken|turkey|beef|pork|egg|yogurt|cheese|tofu|tempeh|seitan|shrimp|tuna|salmon|cod|tilapia|legume|lentil|chickpea|black beans|edamame/.test(text)) role = 'protein';
  else if (/grain|rice|oat|pasta|bread|potato|quinoa|cereal|bagel|pita|tortilla|noodle|polenta|couscous/.test(text)) role = 'carb';

  if (!isCompositeMeal && !isBeverage && !isCondiment) {
    if (food.protein >= 16 && food.protein * 4 >= food.calories * 0.32 && food.fat * 9 <= food.calories * 0.55) role = 'protein';
    if (food.carbs >= 20 && food.carbs * 4 >= food.calories * 0.48 && role !== 'protein') role = 'carb';
    if (food.fat >= 8 && food.fat * 9 >= food.calories * 0.55 && role !== 'protein') role = 'fat';
  }

  const quality = flags.processed || /(dessert|sugary|soda|alcohol|cookie|cake|fries|chips|burger|pizza|donut|candy|pudding|ice cream)/.test(text)
    ? 'limit'
    : isCompositeMeal || /(condiment|cheese|bread|sauce|dressing|oil|butter|nuts|processed)/.test(text)
      ? 'optional'
      : 'core';

  return { role, quality };
};

const normalizeFoodRecord = (food) => {
  const servingGrams = Math.max(5, estimateServingGrams(food.name, food.category));
  const classification = classifyFood(food);
  const baseName = stripServingFromName(food.name) || food.name;
  return {
    ...food,
    baseName,
    servingGrams,
    caloriesPerGram: food.calories / servingGrams,
    proteinPerGram: food.protein / servingGrams,
    carbsPerGram: food.carbs / servingGrams,
    fatPerGram: food.fat / servingGrams,
    fiberPerGram: food.fiber / servingGrams,
    sugarsPerGram: food.sugars / servingGrams,
    sodiumPerGram: food.sodium / servingGrams,
    cholesterolPerGram: food.cholesterol / servingGrams,
    waterMlPerGram: food.waterMl / servingGrams,
    role: classification.role,
    quality: classification.quality,
    scalable: true,
  };
};

const getFoodKey = (food) => toKey(food?.baseName || food?.name || '');

const scaleFood = (food, grams) => {
  const portionGrams = Math.max(1, Math.round(grams));
  return {
    name: `${food.baseName || food.name} (${portionGrams}g)`,
    category: food.category,
    calories: Math.round(food.caloriesPerGram * portionGrams),
    protein: round1(food.proteinPerGram * portionGrams),
    carbs: round1(food.carbsPerGram * portionGrams),
    fat: round1(food.fatPerGram * portionGrams),
    fiber: round1(food.fiberPerGram * portionGrams),
    sugars: round1(food.sugarsPerGram * portionGrams),
    sodium: Math.round(food.sodiumPerGram * portionGrams),
    cholesterol: Math.round(food.cholesterolPerGram * portionGrams),
    waterMl: Math.round(food.waterMlPerGram * portionGrams),
    portionGrams,
    sourceName: food.name,
    role: food.role,
    quality: food.quality,
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

const qualityPenalty = (food, allowLimit = false) => {
  if (food.quality === 'limit') return allowLimit ? 22 : 95;
  if (food.quality === 'optional') return 10;
  return 0;
};

const roleScore = (food, role, goal) => {
  if (role === 'protein') return -(food.proteinPerGram * 160) + (food.fatPerGram * 90) + (food.sodiumPerGram * 0.02) - (food.fiberPerGram * 20);
  if (role === 'carb') {
    const enduranceBonus = goal.includes('endurance') ? food.carbsPerGram * -40 : 0;
    return -(food.carbsPerGram * 80) - (food.fiberPerGram * 35) + enduranceBonus + (food.sugarsPerGram * 25) + (food.fatPerGram * 45);
  }
  if (role === 'produce') return -(food.fiberPerGram * 100) + (food.caloriesPerGram * 18) + (food.sodiumPerGram * 0.04) + (food.sugarsPerGram * 8);
  if (role === 'fat') return -(food.fatPerGram * 50) + (food.sodiumPerGram * 0.02);
  return food.calories;
};

const selectComponent = ({
  foods,
  role,
  mealType,
  usedCounts,
  goal,
  allowLimit = false,
  excludeKeys = new Set(),
}) => {
  const sameMealType = foods.filter((food) => food.mealType === mealType || food.mealType === 'Snack');
  const roleMatches = sameMealType.filter((food) => food.role === role && !excludeKeys.has(getFoodKey(food)));
  const pool = roleMatches.length
    ? roleMatches
    : foods.filter((food) => food.role === role && !excludeKeys.has(getFoodKey(food)));

  const ranked = pool
    .filter((food) => allowLimit || food.quality !== 'limit')
    .map((food) => ({
      food,
      score:
        qualityPenalty(food, allowLimit)
        + roleScore(food, role, goal)
        + (Number(usedCounts.get(getFoodKey(food)) || 0) * 35),
    }))
    .sort((left, right) => left.score - right.score);

  return ranked[0]?.food || null;
};

const scaleForMacro = ({ food, macro, target, minGrams, maxGrams, fallbackGrams }) => {
  const perGram = Number(food?.[`${macro}PerGram`] || 0);
  if (!(perGram > 0) || !(target > 0)) return clamp(fallbackGrams, minGrams, maxGrams);
  return clamp(Math.round(target / perGram), minGrams, maxGrams);
};

const getRemainingTargets = (targets, currentTotals) => ({
  calories: Math.max(0, targets.targetCalories - Number(currentTotals.calories || 0)),
  protein: Math.max(0, targets.targetProtein - Number(currentTotals.protein || 0)),
  carbs: Math.max(0, targets.targetCarbs - Number(currentTotals.carbs || 0)),
  fat: Math.max(0, targets.targetFat - Number(currentTotals.fat || 0)),
});

const getMealTarget = ({ targets, currentTotals, slotIndex }) => {
  const remaining = getRemainingTargets(targets, currentTotals);
  const remainingPortion = SLOT_CONFIG
    .slice(slotIndex)
    .reduce((sum, slot) => sum + Number(slot.portion || 0), 0) || SLOT_CONFIG[slotIndex].portion || 1;
  const share = Number(SLOT_CONFIG[slotIndex].portion || 0) / remainingPortion;
  return {
    calories: Math.max(120, Math.round(remaining.calories * share)),
    protein: Math.max(8, Math.round(remaining.protein * share)),
    carbs: Math.max(8, Math.round(remaining.carbs * share)),
    fat: Math.max(4, Math.round(remaining.fat * share)),
  };
};

const resizeMealToCalories = ({ items, targetCalories }) => {
  let nextItems = [...items];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const totals = sumItems(nextItems);
    const gap = targetCalories - totals.calories;
    if (Math.abs(gap) <= Math.max(45, targetCalories * 0.08)) break;

    const preferredRoles = gap < 0 ? ['fat', 'carb', 'protein'] : ['carb', 'protein', 'fat'];
    const adjustableIndex = preferredRoles
      .map((role) => nextItems.findIndex((item) => item.role === role))
      .find((index) => index >= 0) ?? -1;
    if (adjustableIndex < 0) break;

    const item = nextItems[adjustableIndex];
    const caloriesPerGram = Math.max(0.2, Number(item.calories || 0) / Math.max(1, Number(item.portionGrams || 1)));
    const gramChange = Math.round(gap / caloriesPerGram);
    const minGrams = item.role === 'fat' ? 5 : item.role === 'carb' ? 40 : 55;
    const maxGrams = item.role === 'fat' ? 35 : item.role === 'carb' ? 300 : 240;
    const nextGrams = clamp(Number(item.portionGrams || 0) + gramChange, minGrams, maxGrams);
    if (nextGrams === item.portionGrams) break;

    const sourceFood = item.sourceFood;
    if (!sourceFood) break;
    nextItems = nextItems.map((entry, index) => (index === adjustableIndex ? {
      ...scaleFood(sourceFood, nextGrams),
      sourceFood,
    } : entry));
  }
  return nextItems.map(({ sourceFood, ...item }) => item);
};

const composeMeal = ({ foods, usedCounts, goal, targets, currentTotals, slotIndex }) => {
  const slotConfig = SLOT_CONFIG[slotIndex];
  const mealType = slotConfig.mealType;
  const target = getMealTarget({ targets, currentTotals, slotIndex });
  const excludeKeys = new Set();
  const selected = [];

  const addComponent = (role, grams) => {
    const food = selectComponent({ foods, role, mealType, usedCounts, goal, excludeKeys });
    if (!food) return;
    excludeKeys.add(getFoodKey(food));
    usedCounts.set(getFoodKey(food), Number(usedCounts.get(getFoodKey(food)) || 0) + 1);
    selected.push({
      ...scaleFood(food, grams),
      sourceFood: food,
    });
  };

  if (mealType === 'Snack') {
    const proteinFood = selectComponent({ foods, role: 'protein', mealType, usedCounts, goal, excludeKeys });
    if (proteinFood && target.protein > 8) {
      excludeKeys.add(getFoodKey(proteinFood));
      usedCounts.set(getFoodKey(proteinFood), Number(usedCounts.get(getFoodKey(proteinFood)) || 0) + 1);
      selected.push({
        ...scaleFood(proteinFood, scaleForMacro({
          food: proteinFood,
          macro: 'protein',
          target: target.protein,
          minGrams: 45,
          maxGrams: 180,
          fallbackGrams: 100,
        })),
        sourceFood: proteinFood,
      });
    }
    addComponent(target.carbs > 15 ? 'produce' : 'fat', target.carbs > 15 ? 130 : 18);
  } else {
    const proteinFood = selectComponent({ foods, role: 'protein', mealType, usedCounts, goal, excludeKeys });
    if (proteinFood) {
      excludeKeys.add(getFoodKey(proteinFood));
      usedCounts.set(getFoodKey(proteinFood), Number(usedCounts.get(getFoodKey(proteinFood)) || 0) + 1);
      selected.push({
        ...scaleFood(proteinFood, scaleForMacro({
          food: proteinFood,
          macro: 'protein',
          target: target.protein,
          minGrams: mealType === 'Breakfast' ? 55 : 85,
          maxGrams: mealType === 'Breakfast' ? 190 : 240,
          fallbackGrams: mealType === 'Breakfast' ? 110 : 150,
        })),
        sourceFood: proteinFood,
      });
    }

    const carbFood = selectComponent({ foods, role: 'carb', mealType, usedCounts, goal, excludeKeys });
    if (carbFood) {
      excludeKeys.add(getFoodKey(carbFood));
      usedCounts.set(getFoodKey(carbFood), Number(usedCounts.get(getFoodKey(carbFood)) || 0) + 1);
      selected.push({
        ...scaleFood(carbFood, scaleForMacro({
          food: carbFood,
          macro: 'carbs',
          target: target.carbs,
          minGrams: 45,
          maxGrams: goal.includes('endurance') ? 320 : 260,
          fallbackGrams: 140,
        })),
        sourceFood: carbFood,
      });
    }

    addComponent('produce', mealType === 'Breakfast' ? 100 : 160);
    if (target.fat > 8) {
      const fatFood = selectComponent({ foods, role: 'fat', mealType, usedCounts, goal, excludeKeys });
      if (fatFood) {
        excludeKeys.add(getFoodKey(fatFood));
        usedCounts.set(getFoodKey(fatFood), Number(usedCounts.get(getFoodKey(fatFood)) || 0) + 1);
        selected.push({
          ...scaleFood(fatFood, scaleForMacro({
            food: fatFood,
            macro: 'fat',
            target: Math.min(target.fat, 12),
            minGrams: 6,
            maxGrams: 22,
            fallbackGrams: 12,
          })),
          sourceFood: fatFood,
        });
      }
    }
  }

  const resizedItems = resizeMealToCalories({ items: selected, targetCalories: target.calories });
  return {
    slot: slotConfig.slot,
    items: resizedItems,
    totals: sumItems(resizedItems),
  };
};

const addFinalTopUps = ({ meals, foods, usedCounts, targets, goal }) => {
  let nextMeals = meals.map((meal) => ({ ...meal, items: [...meal.items] }));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const totals = sumItems(nextMeals.flatMap((meal) => meal.items));
    const remaining = getRemainingTargets(targets, totals);
    if (remaining.calories <= 120 && remaining.protein <= 10) break;

    const snackIndex = nextMeals.findIndex((meal) => meal.slot === 'Snack');
    const targetMeal = snackIndex >= 0 ? snackIndex : nextMeals.length - 1;
    const role = remaining.protein > 10 ? 'protein' : remaining.carbs > 18 ? 'carb' : 'fat';
    const food = selectComponent({
      foods,
      role,
      mealType: 'Snack',
      usedCounts,
      goal,
      allowLimit: false,
    });
    if (!food) break;

    const grams = role === 'protein'
      ? scaleForMacro({ food, macro: 'protein', target: Math.min(remaining.protein, 28), minGrams: 45, maxGrams: 160, fallbackGrams: 90 })
      : role === 'carb'
        ? scaleForMacro({ food, macro: 'carbs', target: Math.min(remaining.carbs, 35), minGrams: 40, maxGrams: 180, fallbackGrams: 90 })
        : 12;
    const item = scaleFood(food, grams);
    usedCounts.set(getFoodKey(food), Number(usedCounts.get(getFoodKey(food)) || 0) + 1);
    nextMeals[targetMeal].items.push(item);
    nextMeals[targetMeal].totals = sumItems(nextMeals[targetMeal].items);
  }

  return nextMeals;
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
  const seenFoods = new Set();

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
    const dedupeKey = [
      toKey(food.name),
      toKey(food.category),
      food.mealType,
      Math.round(food.calories),
      Math.round(food.protein),
      Math.round(food.carbs),
      Math.round(food.fat),
    ].join('|');
    if (seenFoods.has(dedupeKey)) continue;
    seenFoods.add(dedupeKey);
    foods.push(normalizeFoodRecord(food));
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
  const meals = SLOT_CONFIG.reduce((acc, _slotConfig, slotIndex) => {
    const currentTotals = sumItems(acc.flatMap((meal) => meal.items));
    const meal = composeMeal({
      foods,
      usedCounts,
      goal,
      targets,
      currentTotals,
      slotIndex,
    });
    if (meal.items.length) acc.push(meal);
    return acc;
  }, []);

  const toppedUpMeals = addFinalTopUps({ meals, foods, usedCounts, targets, goal });

  const normalizedMeals = toppedUpMeals.map((meal) => ({
    slot: meal.slot,
    items: meal.items,
    totals: sumItems(meal.items),
  }));

  const finalTotals = sumItems(normalizedMeals.flatMap((meal) => meal.items));
  const waterFromFoodsMl = Math.round(finalTotals.waterMl);
  const remainingWaterMl = Math.max(0, targets.targetWaterMl - waterFromFoodsMl);
  const validation = {
    caloriesPct: round1(((finalTotals.calories - targets.targetCalories) / Math.max(1, targets.targetCalories)) * 100),
    proteinPct: round1(((finalTotals.protein - targets.targetProtein) / Math.max(1, targets.targetProtein)) * 100),
    carbsPct: round1(((finalTotals.carbs - targets.targetCarbs) / Math.max(1, targets.targetCarbs)) * 100),
    fatPct: round1(((finalTotals.fat - targets.targetFat) / Math.max(1, targets.targetFat)) * 100),
  };
  const isValid = Math.abs(validation.caloriesPct) <= 10 && finalTotals.protein >= targets.targetProtein * 0.85;

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
    validation: {
      ...validation,
      valid: isValid,
    },
    notes: [
      'Generated with component-based meals, scalable portions, and full-day macro validation.',
      'Use weekly adherence, recovery, and body-weight trends before changing calorie targets.',
    ],
  };
};
