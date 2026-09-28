const NUTRITION_ONBOARDING_VERSION = 1;

const CONDITION_KEYS = new Set([
  'diabetes',
  'hypertension',
  'kidneyDisease',
  'cardiovascularDisease',
  'dyslipidemia',
  'digestiveCondition',
  'foodAllergy',
  'otherChronicCondition',
]);

const toBooleanOrNull = (value) => {
  if (value === true || value === false) return value;
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return null;
};

const cleanList = (value) => {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 24);
};

export const normalizeNutritionHealthProfile = (input = {}) => {
  const preferNotToSay = Boolean(input.preferNotToSay);
  const rawConditions = input.conditions && typeof input.conditions === 'object' ? input.conditions : {};
  const noKnownCondition = Boolean(input.noKnownCondition || rawConditions.noKnownCondition);

  if (preferNotToSay || noKnownCondition) {
    return {
      conditions: {},
      noKnownCondition,
      preferNotToSay,
      allergies: cleanList(input.allergies),
      intolerances: cleanList(input.intolerances),
      clinicianNutritionPlan: toBooleanOrNull(input.clinicianNutritionPlan),
      onboardingVersion: NUTRITION_ONBOARDING_VERSION,
      completedAt: input.completedAt || new Date().toISOString(),
    };
  }

  const conditions = {};
  for (const key of CONDITION_KEYS) {
    const value = rawConditions[key];
    if (key === 'diabetes') {
      const enabled = Boolean(value?.enabled || value === true);
      if (enabled) {
        const type = ['type1', 'type2', 'other', 'unknown'].includes(String(value?.type || ''))
          ? String(value.type)
          : 'unknown';
        conditions.diabetes = { enabled: true, type };
      }
      continue;
    }

    if (key === 'kidneyDisease') {
      const enabled = Boolean(value?.enabled || value === true);
      if (enabled) {
        conditions.kidneyDisease = {
          enabled: true,
          clinicianNutritionPlan: toBooleanOrNull(value?.clinicianNutritionPlan),
        };
      }
      continue;
    }

    if (value === true || value?.enabled === true) {
      conditions[key] = true;
    }
  }

  return {
    conditions,
    noKnownCondition: false,
    preferNotToSay: false,
    allergies: cleanList(input.allergies),
    intolerances: cleanList(input.intolerances),
    clinicianNutritionPlan: toBooleanOrNull(input.clinicianNutritionPlan),
    onboardingVersion: NUTRITION_ONBOARDING_VERSION,
    completedAt: input.completedAt || new Date().toISOString(),
  };
};

export const buildNutritionSafetyDecision = ({ healthProfile = {}, targets = {} } = {}) => {
  const profile = normalizeNutritionHealthProfile(healthProfile || {});
  const conditions = profile.conditions || {};
  const warnings = [];
  const nutrientPriorities = [];
  const mealFilters = {
    allergies: profile.allergies || [],
    intolerances: profile.intolerances || [],
  };
  let clinicianPersonalizationRequired = false;
  let restrictAutomatedRecommendations = false;

  if (conditions.kidneyDisease?.enabled) {
    clinicianPersonalizationRequired = true;
    restrictAutomatedRecommendations = true;
    warnings.push('Your nutrition needs may require individual guidance. Automated high-protein personalization is limited until a clinician plan is confirmed.');
  }

  if (conditions.diabetes?.enabled) {
    nutrientPriorities.push('carbohydrateDistribution');
    warnings.push('Carbohydrate tracking is highlighted. RepSet does not provide medication or insulin guidance.');
  }

  if (conditions.hypertension) {
    nutrientPriorities.push('sodiumVisibility');
    warnings.push('Sodium is surfaced when available in the food dataset. RepSet does not diagnose or treat blood pressure conditions.');
  }

  if (conditions.foodAllergy || mealFilters.allergies.length || mealFilters.intolerances.length) {
    nutrientPriorities.push('allergyAwareness');
    warnings.push('Review generated meals for your declared allergies or intolerances before eating.');
  }

  return {
    onboardingVersion: NUTRITION_ONBOARDING_VERSION,
    allowedAutomation: {
      tracking: true,
      mealGeneration: !restrictAutomatedRecommendations,
      hydrationLogging: true,
    },
    restrictedAutomation: {
      clinicalNutrition: true,
      highProteinPersonalization: clinicianPersonalizationRequired,
    },
    clinicianPersonalizationRequired,
    nutrientPriorities,
    mealFilters,
    warnings,
    targetReview: {
      calories: Number(targets.calories || targets.targetCalories || 0) || null,
      protein: Number(targets.protein || targets.targetProtein || 0) || null,
      waterMl: Number(targets.waterMl || targets.targetWaterMl || 0) || null,
    },
  };
};

export { NUTRITION_ONBOARDING_VERSION };
