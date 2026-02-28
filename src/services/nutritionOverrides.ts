export type NutritionInputOverride = {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  goal: string;
  daysPerWeek: number;
  updatedAt: string;
};

export const NUTRITION_INPUTS_UPDATED_EVENT = 'nutrition-inputs-updated';

const STORAGE_PREFIX = 'nutrition_inputs_override_v1';

const buildKey = (userId: number) => `${STORAGE_PREFIX}:${userId}`;

export const getNutritionInputsOverride = (userId: number): NutritionInputOverride | null => {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  try {
    const raw = localStorage.getItem(buildKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const age = Number(parsed.age);
    const weightKg = Number(parsed.weightKg);
    const heightCm = Number(parsed.heightCm);
    const daysPerWeek = Number(parsed.daysPerWeek);
    const sex: 'male' | 'female' = String(parsed.sex || '').toLowerCase() === 'female' ? 'female' : 'male';
    const goal = String(parsed.goal || '').trim() || 'general_fitness';
    const updatedAt = String(parsed.updatedAt || new Date().toISOString());

    if (!Number.isFinite(age) || !Number.isFinite(weightKg) || !Number.isFinite(heightCm) || !Number.isFinite(daysPerWeek)) {
      return null;
    }

    return {
      age,
      sex,
      weightKg,
      heightCm,
      goal,
      daysPerWeek,
      updatedAt,
    };
  } catch {
    return null;
  }
};

export const saveNutritionInputsOverride = (
  userId: number,
  input: Omit<NutritionInputOverride, 'updatedAt'>,
): NutritionInputOverride | null => {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const payload: NutritionInputOverride = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(buildKey(userId), JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(NUTRITION_INPUTS_UPDATED_EVENT, { detail: { userId, payload } }));
  return payload;
};

export const clearNutritionInputsOverride = (userId: number) => {
  if (!Number.isFinite(userId) || userId <= 0) return;
  localStorage.removeItem(buildKey(userId));
  window.dispatchEvent(new CustomEvent(NUTRITION_INPUTS_UPDATED_EVENT, { detail: { userId, cleared: true } }));
};

