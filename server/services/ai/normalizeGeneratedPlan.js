// @ts-check

import {
  AI_PLAN_PHASE_BLUEPRINT,
  AI_TRAINING_PLAN_DURATION_WEEKS,
  AI_TRAINING_PLAN_SCHEMA_VERSION,
  ALLOWED_TARGET_MUSCLES,
  CANONICAL_WEEK_DAYS,
} from './types.js';

const DAY_ALIASES = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const sanitizeText = (value, fallback = '', maxLength = 400) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDayName = (value, fallbackIndex = 0) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized && DAY_ALIASES[normalized]) {
    return DAY_ALIASES[normalized];
  }
  return CANONICAL_WEEK_DAYS[fallbackIndex % CANONICAL_WEEK_DAYS.length];
};

const normalizeWeekRange = (value, fallback) => {
  const start = clampInt(value?.start, 1, AI_TRAINING_PLAN_DURATION_WEEKS, fallback.start);
  const end = clampInt(value?.end, start, AI_TRAINING_PLAN_DURATION_WEEKS, fallback.end);
  return { start, end };
};

const normalizeTargetMuscles = (value) => {
  const items = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[,;/|]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const normalized = items
    .map((item) => sanitizeText(item, '', 40))
    .filter(Boolean)
    .map((item) => {
      const match = ALLOWED_TARGET_MUSCLES.find(
        (candidate) => candidate.toLowerCase() === item.toLowerCase(),
      );
      return match || item;
    });

  return Array.from(new Set(normalized)).slice(0, 3);
};

const inferWorkoutType = (workout) => {
  const source = `${workout?.workoutType || ''} ${workout?.sessionName || ''} ${workout?.workoutName || ''} ${workout?.focus || ''}`
    .trim()
    .toLowerCase();

  if (/\bpush\b/.test(source)) return 'Push';
  if (/\bpull\b/.test(source)) return 'Pull';
  if (/\blegs?\b|lower/.test(source)) return 'Legs';
  if (/upper/.test(source)) return 'Upper Body';
  if (/full body|full-body/.test(source)) return 'Full Body';
  return 'Full Body';
};

const normalizeExercise = (exercise, fallbackIndex = 0) => ({
  name: sanitizeText(exercise?.name, `Exercise ${fallbackIndex + 1}`, 120),
  targetMuscles: normalizeTargetMuscles(exercise?.targetMuscles),
  sets: clampInt(exercise?.sets, 1, 8, 3),
  reps: sanitizeText(exercise?.reps, '8-12', 32),
  restSeconds: clampInt(exercise?.restSeconds, 15, 240, 75),
  tempo: sanitizeText(exercise?.tempo, '', 20) || null,
  rpeTarget: Number(clampNumber(exercise?.rpeTarget, 5, 10, 7.5).toFixed(1)),
  notes: sanitizeText(exercise?.notes, '', 240),
});

const normalizeWorkoutDay = (workout, payload, fallbackIndex = 0) => ({
  dayName: normalizeDayName(workout?.dayName, fallbackIndex),
  sessionName: sanitizeText(workout?.sessionName || workout?.workoutName, `Session ${fallbackIndex + 1}`, 120),
  workoutName: sanitizeText(workout?.sessionName || workout?.workoutName, `Session ${fallbackIndex + 1}`, 120),
  workoutType: inferWorkoutType(workout),
  focus: sanitizeText(workout?.focus, 'General development', 180),
  estimatedDurationMinutes: clampInt(
    workout?.estimatedDurationMinutes,
    25,
    120,
    clampInt(payload?.session_duration_minutes, 30, 120, 60),
  ),
  notes: sanitizeText(workout?.notes, '', 240),
  exercises: toArray(workout?.exercises)
    .slice(0, 10)
    .map((exercise, exerciseIndex) => normalizeExercise(exercise, exerciseIndex)),
});

const buildFallbackWeeklyWorkouts = (payload) => {
  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  return CANONICAL_WEEK_DAYS.slice(0, requestedDays).map((dayName, index) => ({
    dayName,
    sessionName: `Training Day ${index + 1}`,
    workoutName: `Training Day ${index + 1}`,
    workoutType: 'Full Body',
    focus: 'Goal-specific strength and hypertrophy work',
    estimatedDurationMinutes: clampInt(payload?.session_duration_minutes, 30, 120, 60),
    notes: '',
    exercises: [
      {
        name: 'Primary Compound Lift',
        targetMuscles: ['Full Body'],
        sets: 4,
        reps: '6-8',
        restSeconds: 120,
        tempo: null,
        rpeTarget: 7.5,
        notes: 'Use controlled technique and keep 1-3 reps in reserve.',
      },
      {
        name: 'Secondary Accessory Lift',
        targetMuscles: ['Full Body'],
        sets: 3,
        reps: '8-12',
        restSeconds: 75,
        tempo: null,
        rpeTarget: 7.0,
        notes: 'Prioritize smooth tempo and full range of motion.',
      },
    ],
  }));
};

const buildPhasesFromLegacySchedule = (rawPlan, payload) => {
  const baseWorkouts = toArray(rawPlan?.weeklySchedule)
    .slice(0, clampInt(payload?.days_per_week, 2, 6, 4))
    .map((workout, index) => normalizeWorkoutDay(workout, payload, index));
  const fallbackWorkouts = baseWorkouts.length ? baseWorkouts : buildFallbackWeeklyWorkouts(payload);

  return AI_PLAN_PHASE_BLUEPRINT.map((phase) => ({
    phaseName: phase.label,
    weekRange: { start: phase.startWeek, end: phase.endWeek },
    objective: `Progress ${sanitizeText(payload?.goal, 'training')} with phase-specific overload.`,
    workouts: fallbackWorkouts.map((workout) => ({
      ...workout,
      notes: sanitizeText(
        workout.notes || `Weeks ${phase.startWeek}-${phase.endWeek}: adjust load, effort, or tempo for this phase.`,
        '',
        240,
      ),
    })),
  }));
};

const normalizeWorkoutsByPhase = (rawPlan, payload) => {
  const rawPhases = toArray(rawPlan?.workoutsByPhase);
  if (!rawPhases.length) {
    return buildPhasesFromLegacySchedule(rawPlan, payload);
  }

  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  const fallbackWorkouts = buildFallbackWeeklyWorkouts(payload);

  return AI_PLAN_PHASE_BLUEPRINT.map((blueprint, phaseIndex) => {
    const rawPhase = rawPhases[phaseIndex] || rawPhases[rawPhases.length - 1] || {};
    const rawWorkouts = toArray(rawPhase?.workouts);
    const normalizedWorkouts = (rawWorkouts.length ? rawWorkouts : fallbackWorkouts)
      .slice(0, requestedDays)
      .map((workout, workoutIndex) => normalizeWorkoutDay(workout, payload, workoutIndex));

    while (normalizedWorkouts.length < requestedDays) {
      normalizedWorkouts.push(
        normalizeWorkoutDay(fallbackWorkouts[normalizedWorkouts.length], payload, normalizedWorkouts.length),
      );
    }

    return {
      phaseName: sanitizeText(rawPhase?.phaseName, blueprint.label, 120),
      weekRange: normalizeWeekRange(rawPhase?.weekRange, {
        start: blueprint.startWeek,
        end: blueprint.endWeek,
      }),
      objective: sanitizeText(
        rawPhase?.objective,
        `${blueprint.label} phase for ${sanitizeText(payload?.goal, 'goal progression')}.`,
        220,
      ),
      workouts: normalizedWorkouts,
    };
  });
};

const buildWeeklySplit = (rawPlan, phases) =>
  AI_PLAN_PHASE_BLUEPRINT.map((blueprint, phaseIndex) => {
    const phase = phases[phaseIndex];
    const rawSplit = toArray(rawPlan?.weeklySplit)[phaseIndex] || {};

    return {
      weekRange: normalizeWeekRange(rawSplit?.weekRange, phase.weekRange),
      splitName: sanitizeText(rawSplit?.splitName, `${phase.phaseName} Split`, 120),
      rationale: sanitizeText(rawSplit?.rationale, phase.objective, 220),
      trainingDays: phase.workouts.map((workout) => ({
        dayName: workout.dayName,
        sessionName: workout.sessionName,
        focus: workout.focus,
        estimatedDurationMinutes: workout.estimatedDurationMinutes,
      })),
    };
  });

const normalizeStrategyItems = (items, fallbackTitlePrefix) =>
  toArray(items).map((item, index) => ({
    weekRange: item && typeof item === 'object' && item.weekRange && typeof item.weekRange === 'object'
      ? {
          start: clampInt(item.weekRange.start, 1, AI_TRAINING_PLAN_DURATION_WEEKS, 1),
          end: clampInt(item.weekRange.end, 1, AI_TRAINING_PLAN_DURATION_WEEKS, 2),
        }
      : null,
    title: sanitizeText(
      typeof item === 'string' ? `${fallbackTitlePrefix} ${index + 1}` : item?.title,
      `${fallbackTitlePrefix} ${index + 1}`,
      120,
    ),
    details: sanitizeText(
      typeof item === 'string' ? item : item?.details || item?.detail,
      '',
      260,
    ),
  }))
    .filter((item) => item.details);

const normalizeTextNotes = (items, fallbackPrefix) =>
  toArray(items).map((item, index) => {
    if (typeof item === 'string') {
      return sanitizeText(item, '', 260);
    }

    const title = sanitizeText(item?.title, `${fallbackPrefix} ${index + 1}`, 120);
    const details = sanitizeText(item?.details || item?.detail, '', 220);
    if (!details) return '';
    return `${title}: ${details}`;
  }).filter(Boolean);

export const normalizeGeneratedPlan = (rawPlan, payload, { narrativeText = '' } = {}) => {
  const phases = normalizeWorkoutsByPhase(rawPlan, payload);
  const weeklySplit = buildWeeklySplit(rawPlan, phases);
  const progressionStrategy = normalizeStrategyItems(rawPlan?.progressionStrategy, 'Progression');
  const recoveryStrategy = normalizeStrategyItems(rawPlan?.recoveryStrategy, 'Recovery');
  const coachNotes = normalizeStrategyItems(rawPlan?.coachNotes, 'Coach Note');

  const summary = sanitizeText(
    rawPlan?.programOverview || rawPlan?.summary,
    `An ${AI_TRAINING_PLAN_DURATION_WEEKS}-week plan built for ${sanitizeText(payload?.goal, 'your goal')}.`,
    320,
  );
  const coachingInterpretation = sanitizeText(
    rawPlan?.coachingInterpretation || rawPlan?.goalMatch || narrativeText,
    'This plan reflects the user profile, branch selection, recovery needs, and weekly availability.',
    320,
  );

  const normalizedPlan = {
    schemaVersion: AI_TRAINING_PLAN_SCHEMA_VERSION,
    provider: 'anthropic',
    durationWeeks: AI_TRAINING_PLAN_DURATION_WEEKS,
    generatedAt: new Date().toISOString(),
    planName: sanitizeText(rawPlan?.planName, 'AI Coach 8-Week Plan', 120),
    summary,
    goalMatch: coachingInterpretation,
    userSummary: {
      name: sanitizeText(rawPlan?.userSummary?.name, payload?.name, 80) || null,
      goal: sanitizeText(rawPlan?.userSummary?.goal, payload?.goal, 120),
      fitnessLevel: sanitizeText(rawPlan?.userSummary?.fitnessLevel, payload?.fitness_level, 60),
      mainProfileCategory: sanitizeText(
        rawPlan?.userSummary?.mainProfileCategory,
        payload?.main_profile_category,
        120,
      ),
      selectedSubCategory: sanitizeText(
        rawPlan?.userSummary?.selectedSubCategory,
        payload?.selected_sub_category,
        160,
      ) || null,
      daysPerWeek: clampInt(rawPlan?.userSummary?.daysPerWeek, 2, 6, payload?.days_per_week),
      sessionDurationMinutes: clampInt(
        rawPlan?.userSummary?.sessionDurationMinutes,
        30,
        120,
        payload?.session_duration_minutes,
      ),
    },
    programOverview: summary,
    coachingInterpretation,
    photoAnalysisSummary: sanitizeText(
      rawPlan?.photoAnalysisSummary,
      payload?.photo_analysis_summary_or_null,
      420,
    ) || null,
    weeklySplit,
    workoutsByPhase: phases,
    progressionStrategy,
    recoveryStrategy,
    nutritionGuidance: normalizeTextNotes(rawPlan?.nutritionGuidance, 'Nutrition'),
    coachNotes,
    finalCoachMessage: sanitizeText(
      rawPlan?.finalCoachMessage,
      'Focus on consistency, quality reps, and progressive execution across the full 8 weeks.',
      320,
    ),
    weeklySchedule: phases[0]?.workouts || buildFallbackWeeklyWorkouts(payload),
    progressionRules: progressionStrategy.map((item) =>
      `${item.weekRange ? `Weeks ${item.weekRange.start}-${item.weekRange.end}` : item.title}: ${item.details}`),
    recoveryRules: recoveryStrategy.map((item) => `${item.title}: ${item.details}`),
    checkpoints: progressionStrategy.map((item, index) => ({
      week: clampInt(item?.weekRange?.end, 1, AI_TRAINING_PLAN_DURATION_WEEKS, ((index + 1) * 2)),
      target: sanitizeText(item.details, item.title, 180),
    })),
  };

  return normalizedPlan;
};
