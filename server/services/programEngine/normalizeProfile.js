const SUPPORTED_IDENTITIES = new Set(['bodybuilding', 'cardio']);
const BYPASS_IDENTITIES = new Set(['hyrox', 'boxing']);

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMachineText = (value) => normalizeText(value).replace(/\s+/g, '_');

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeProgramEngineIdentity = (value) => {
  const key = normalizeMachineText(value);
  if (!key) return null;
  if (key === 'bodybuilder') return 'bodybuilding';
  if (key === 'box' || key === 'boxing' || key === 'combat_sports') return 'boxing';
  if (key === 'hyrox') return 'hyrox';
  if (key === 'cardio') return 'cardio';
  if (key === 'bodybuilding') return 'bodybuilding';
  return key;
};

export const normalizeProgramEngineGender = (value) => {
  const key = normalizeText(value);
  if (['man', 'male', 'm'].includes(key)) return 'man';
  if (['woman', 'female', 'f'].includes(key)) return 'woman';
  return key || null;
};

export const normalizeProgramEngineExperience = (value) => {
  const key = normalizeText(value);
  if (!key) return null;
  if (key === 'beginner' || key.includes('new') || key.includes('returning')) return 'beginner';
  if (key === 'intermediate' || key.includes('regular') || key.includes('consistent')) return 'intermediate';
  if (key === 'advanced' || key.includes('experienced') || key.includes('high confidence')) return 'advanced';
  return key;
};

export const normalizeProgramEngineBodyType = (value) => {
  const key = normalizeMachineText(value);
  if (['ectomorph', 'mesomorph', 'endomorph'].includes(key)) return key;
  return key || null;
};

export const normalizeProgramEngineGoal = (...values) => {
  const candidates = values.flatMap((value) => (Array.isArray(value) ? value : [value]));

  for (const candidate of candidates) {
    const key = normalizeText(candidate);
    if (!key) continue;

    if (key === 'hypertrophy' || key.includes('hypertrophy')) return 'hypertrophy';
    if (key === 'powerlifting' || key.includes('powerlifting')) return 'powerlifting';
    if (key === 'strength' || key.includes('strength focus')) return 'powerlifting';
    if (key === 'cutting' || key.includes('cutting')) return 'cutting';
    if (key === 'bulking' || key.includes('bulking')) return 'bulking';
    if (key === 'fat loss' || key === 'fat_loss' || (key.includes('fat') && key.includes('loss'))) return 'fat_loss';
    if (key === 'endurance' || key.includes('endurance')) return 'endurance';
  }

  return null;
};

const normalizeTrainingFocus = (value) => {
  const key = normalizeText(value);
  if (!key) return null;
  if (key === 'balanced') return 'balanced';
  if (key.includes('muscle') || key.includes('hypertrophy')) return 'hypertrophy';
  if (key.includes('strength')) return 'strength';
  if (key.includes('fat') && key.includes('loss')) return 'fat_loss';
  return normalizeMachineText(value);
};

const normalizeRecoveryStrategy = (value) => {
  const key = normalizeText(value);
  if (!key) return null;
  if (key === 'balanced') return 'balanced';
  if (key.includes('push') || key.includes('performance')) return 'performance';
  if (key.includes('conservative') || key.includes('recovery')) return 'recovery';
  return normalizeMachineText(value);
};

const normalizePreferredTime = (value) => {
  const key = normalizeText(value);
  if (['morning', 'afternoon', 'evening'].includes(key)) return key;
  return key || null;
};

const normalizeCycleContext = (value) => {
  if (!value || typeof value !== 'object') return null;

  const lastPeriodStart = firstNonEmpty(value.lastPeriodStart, value.last_period_start);
  const typicalCycleLength = toFiniteNumber(firstNonEmpty(value.typicalCycleLength, value.typical_cycle_length));
  const typicalPeriodDuration = toFiniteNumber(firstNonEmpty(value.typicalPeriodDuration, value.typical_period_duration));
  const stats = value.stats && typeof value.stats === 'object' ? value.stats : null;

  if (!lastPeriodStart && typicalCycleLength == null && typicalPeriodDuration == null && !stats) {
    return null;
  }

  return {
    lastPeriodStart: lastPeriodStart || null,
    typicalCycleLength,
    typicalPeriodDuration,
    stats,
  };
};

export const getProgramEngineBypassReason = (profileOrInput = {}) => {
  const identity = normalizeProgramEngineIdentity(profileOrInput.identity ?? profileOrInput.athleteIdentity);
  if (!BYPASS_IDENTITIES.has(identity)) return null;
  return identity;
};

export const normalizeTrainingProfile = (input = {}) => {
  const identity = normalizeProgramEngineIdentity(input.identity ?? input.athleteIdentity ?? input.athlete_identity);
  const goal = normalizeProgramEngineGoal(
    input.goal,
    input.athleteSubCategoryId,
    input.athleteSubCategoryIds,
    input.athleteSubCategoryLabel,
    input.athleteGoal,
    input.fitnessGoal,
    input.primaryGoal,
    input.aiTrainingFocus,
    input.trainingFocus,
  );
  const experience = normalizeProgramEngineExperience(input.experience ?? input.experienceLevel ?? input.experience_level);
  const daysPerWeek = toFiniteNumber(input.daysPerWeek ?? input.workoutDays ?? input.workout_days);
  const sessionDurationMinutes = toFiniteNumber(
    input.sessionDurationMinutes
      ?? input.sessionDuration
      ?? input.session_duration_minutes,
  );
  const gender = normalizeProgramEngineGender(input.gender);

  return {
    engineTarget: SUPPORTED_IDENTITIES.has(identity) ? 'program_engine' : 'legacy',
    bypassReason: BYPASS_IDENTITIES.has(identity) ? identity : null,
    gender,
    age: toFiniteNumber(input.age),
    heightCm: toFiniteNumber(input.heightCm ?? input.height ?? input.height_cm),
    weightKg: toFiniteNumber(input.weightKg ?? input.weight ?? input.weight_kg),
    bodyType: normalizeProgramEngineBodyType(input.bodyType ?? input.bodyTypeLabel),
    motivation: normalizeMachineText(input.motivation ?? input.onboardingReason ?? input.appMotivation ?? input.appMotivationLabel) || null,
    identity,
    goal,
    experience,
    daysPerWeek,
    sessionDurationMinutes,
    preferredTime: normalizePreferredTime(input.preferredTime ?? input.preferred_time),
    trainingFocus: normalizeTrainingFocus(input.trainingFocus ?? input.aiTrainingFocus),
    recoveryStrategy: normalizeRecoveryStrategy(input.recoveryStrategy ?? input.aiRecoveryPriority),
    injuriesOrMovementsToAvoid: firstNonEmpty(input.injuriesOrMovementsToAvoid, input.aiLimitations) || null,
    equipmentNotes: firstNonEmpty(input.equipmentNotes, input.aiEquipmentNotes) || null,
    cycleContext: normalizeCycleContext(input.cycleContext ?? input.periodCycle ?? input.period_cycle),
  };
};

export const isProgramEngineSupportedProfile = (profileOrInput = {}) => {
  const profile = profileOrInput.identity && Object.hasOwn(profileOrInput, 'engineTarget')
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);

  return profile.engineTarget === 'program_engine' && !profile.bypassReason;
};

