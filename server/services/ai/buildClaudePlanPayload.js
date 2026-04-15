// @ts-check

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const sanitizeText = (value, fallback = null, maxLength = 320) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
};

const sanitizeSnapshot = (value, depth = 0) => {
  if (value == null) return null;
  if (depth > 2) return '[max_depth]';

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((entry) => sanitizeSnapshot(entry, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => String(key || '').trim().toLowerCase() !== 'bodyimages')
        .slice(0, 60)
        .map(([key, entryValue]) => [key, sanitizeSnapshot(entryValue, depth + 1)]),
    );
  }

  if (typeof value === 'string') {
    return sanitizeText(value, '', 280);
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
};

const normalizeGender = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'female') return normalized;
  return 'unspecified';
};

const normalizeLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['beginner', 'intermediate', 'advanced'].includes(normalized)) return normalized;
  return 'intermediate';
};

const normalizeLanguage = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['ar', 'de', 'en', 'fr', 'it'].includes(normalized)) return normalized;
  return 'en';
};

const normalizeSplit = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['upperlower', 'ul'].includes(normalized)) return 'upper_lower';
  if (['ppl', 'pushpulllegs'].includes(normalized)) return 'push_pull_legs';
  if (['ppl_ul', 'pplul'].includes(normalized)) return 'hybrid';
  if (['splitpush', 'split_push', 'sp'].includes(normalized)) return 'split_push';
  if (['auto', 'full_body', 'upper_lower', 'push_pull_legs', 'hybrid', 'split_push', 'custom'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
};

const normalizeGoal = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'general_fitness';
  return normalized.replace(/\s+/g, '_').slice(0, 80);
};

const normalizeBranchFamily = (mainCategory, athleteIdentityCategory) => {
  const normalizedMain = String(mainCategory || '').trim().toLowerCase();
  const normalizedCategory = String(athleteIdentityCategory || '').trim().toLowerCase();
  if (normalizedCategory === 'athlete_sports') return 'sport_performance';
  if (/body\s*shaping|body_shaping/.test(normalizedMain)) return 'female_body_shaping';
  if (/bodybuilding|strength/.test(normalizedMain)) return 'strength_bodybuilding';
  if (/cardio|conditioning|endurance/.test(normalizedMain)) return 'cardio_conditioning';
  if (normalizedCategory === 'fitness') return 'fitness_general';
  return normalizedMain || normalizedCategory || 'general_fitness';
};

const resolvePlanningTrack = (gender, mainCategory, selectedSubCategory) => {
  const normalizedGender = normalizeGender(gender);
  const main = `${mainCategory || ''}`.toLowerCase();
  const sub = `${selectedSubCategory || ''}`.toLowerCase();

  if (
    normalizedGender === 'female'
    || /glute|toning|silhouette|posture|body\s*shaping|fat\s*loss|muscle\s*strengthening|beginner fitness/.test(`${main} ${sub}`)
  ) {
    return 'female';
  }

  if (
    normalizedGender === 'male'
    || /powerlifting|mass gain|classic physique|natural athlete|cutting|hypertrophy|football|basketball|handball|swimming|combat/.test(`${main} ${sub}`)
  ) {
    return 'male';
  }

  return 'neutral';
};

const resolveBranchRationale = (planningTrack, branchFamily, selectedSubCategory) => {
  const branch = String(selectedSubCategory || '').trim();
  if (planningTrack === 'female') {
    return [
      'Use women-specific planning logic first.',
      `Primary branch family: ${branchFamily}.`,
      branch ? `Selected branch: ${branch}.` : 'No narrower branch was provided.',
      'Prioritize the selected female branch over generic male bodybuilding templates.',
    ].join(' ');
  }

  if (planningTrack === 'male') {
    return [
      'Use men-specific planning logic first.',
      `Primary branch family: ${branchFamily}.`,
      branch ? `Selected branch: ${branch}.` : 'No narrower branch was provided.',
      'Respect the exact onboarding branch before choosing split, volume, and intensity.',
    ].join(' ');
  }

  return [
    `Primary branch family: ${branchFamily}.`,
    branch ? `Selected branch: ${branch}.` : 'No narrower branch was provided.',
    'Use the branch taxonomy and explicit onboarding preferences as the primary planning anchor.',
  ].join(' ');
};

export const buildClaudePlanOnboardingPayload = (
  profile = {},
  {
    bodyImages = [],
    userName = null,
  } = {},
) => {
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const rawSnapshot = safeProfile.onboardingFields && typeof safeProfile.onboardingFields === 'object'
    ? safeProfile.onboardingFields
    : {};

  const mainProfileCategory = sanitizeText(
    safeProfile.mainProfileCategory
      || safeProfile.main_profile_category
      || safeProfile.athleteIdentityLabel
      || safeProfile.athleteIdentity
      || safeProfile.athleteIdentityCategory
      || 'General Fitness',
    'General Fitness',
    120,
  );

  const selectedSubCategory = sanitizeText(
    safeProfile.selectedSubCategory
      || safeProfile.selected_sub_category
      || safeProfile.athleteSubCategoryLabel
      || safeProfile.athleteGoal
      || null,
    null,
    160,
  );

  const planningTrack = resolvePlanningTrack(
    safeProfile.gender,
    mainProfileCategory,
    selectedSubCategory,
  );
  const branchFamily = normalizeBranchFamily(mainProfileCategory, safeProfile.athleteIdentityCategory);

  return {
    user_id: Number.isFinite(Number(safeProfile.userId || rawSnapshot.userId))
      ? Number(safeProfile.userId || rawSnapshot.userId)
      : null,
    name: sanitizeText(
      safeProfile.name
        || safeProfile.userName
        || userName
        || rawSnapshot.firstName
        || rawSnapshot.name,
      null,
      80,
    ),
    gender: normalizeGender(safeProfile.gender),
    age: Number.isFinite(Number(safeProfile.age)) ? Number(safeProfile.age) : null,
    height_cm: Number.isFinite(Number(safeProfile.heightCm)) ? Number(safeProfile.heightCm) : null,
    weight_kg: Number.isFinite(Number(safeProfile.weightKg)) ? Number(safeProfile.weightKg) : null,
    motivation: sanitizeText(safeProfile.motivation, null, 240),
    goal: normalizeGoal(safeProfile.goal),
    fitness_level: normalizeLevel(safeProfile.experienceLevel),
    main_profile_category: mainProfileCategory,
    selected_sub_category: selectedSubCategory,
    days_per_week: clampInt(safeProfile.daysPerWeek, 2, 6, 4),
    session_duration_minutes: clampInt(safeProfile.sessionDuration, 30, 120, 60),
    preferred_training_time: sanitizeText(safeProfile.preferredTime, null, 40),
    body_type_or_null: sanitizeText(safeProfile.bodyType, null, 80),
    photo_analysis_summary_or_null: sanitizeText(
      safeProfile.photoAnalysisSummary
        || safeProfile.photo_analysis_summary_or_null
        || rawSnapshot.photoAnalysisSummary
        || rawSnapshot.bodyAnalysisSummary
        || null,
      null,
      600,
    ),
    split_preference: normalizeSplit(safeProfile.preferredSplit),
    split_label: sanitizeText(safeProfile.preferredSplitLabel, null, 80),
    training_focus: sanitizeText(safeProfile.trainingFocus, null, 80),
    recovery_priority: sanitizeText(safeProfile.recoveryPriority, null, 80),
    limitations: sanitizeText(safeProfile.limitations, null, 300),
    equipment_notes: sanitizeText(safeProfile.equipmentNotes, null, 240),
    available_equipment: sanitizeText(safeProfile.equipment, null, 240),
    language: normalizeLanguage(safeProfile.language),
    images_provided_count: Array.isArray(bodyImages) ? bodyImages.filter(Boolean).length : 0,
    athlete_identity: sanitizeText(safeProfile.athleteIdentity, null, 80),
    athlete_identity_category: sanitizeText(safeProfile.athleteIdentityCategory, null, 80),
    athlete_sub_category_id: sanitizeText(safeProfile.athleteSubCategoryId, null, 80),
    athlete_sub_category_label: sanitizeText(safeProfile.athleteSubCategoryLabel, null, 120),
    athlete_goal: sanitizeText(safeProfile.athleteGoal, null, 120),
    taxonomy: {
      planning_track: planningTrack,
      branch_family: branchFamily,
      branch_focus: selectedSubCategory,
      branch_rationale: resolveBranchRationale(planningTrack, branchFamily, selectedSubCategory),
    },
    onboarding_snapshot: sanitizeSnapshot(rawSnapshot) || {},
  };
};

export const validateClaudePlanOnboardingPayload = (payload) => {
  const issues = [];

  if (!payload || typeof payload !== 'object') {
    return ['Onboarding payload is missing.'];
  }

  if (!sanitizeText(payload.goal, null, 120)) {
    issues.push('Goal is required for AI plan generation.');
  }
  if (!sanitizeText(payload.main_profile_category, null, 120)) {
    issues.push('Main profile category is required for AI plan generation.');
  }
  if (!sanitizeText(payload.fitness_level, null, 40)) {
    issues.push('Fitness level is required for AI plan generation.');
  }
  if (!Number.isFinite(Number(payload.days_per_week)) || Number(payload.days_per_week) < 2) {
    issues.push('Training days per week must be between 2 and 6.');
  }
  if (!Number.isFinite(Number(payload.session_duration_minutes)) || Number(payload.session_duration_minutes) < 30) {
    issues.push('Session duration must be between 30 and 120 minutes.');
  }

  return issues;
};
