// @ts-check

import {
  AI_PLAN_PHASE_BLUEPRINT,
  AI_TRAINING_PLAN_DURATION_WEEKS,
  CANONICAL_WEEK_DAYS,
} from './types.js';

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const sanitizeText = (value, fallback = '', maxLength = 320) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeTextKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeDayName = (value, fallbackIndex = 0) => {
  const key = normalizeTextKey(value);
  const normalized = CANONICAL_WEEK_DAYS.find((day) => normalizeTextKey(day) === key);
  return normalized || CANONICAL_WEEK_DAYS[fallbackIndex % CANONICAL_WEEK_DAYS.length];
};

const parseRepRange = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return { min: null, max: null };
  const numbers = matches.map((item) => Number(item)).filter(Number.isFinite);
  if (!numbers.length) return { min: null, max: null };
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

export const getExpectedWeekRanges = () =>
  AI_PLAN_PHASE_BLUEPRINT.map((phase) => ({
    phaseName: phase.label,
    weekRange: { start: phase.startWeek, end: phase.endWeek },
  }));

export const buildBranchGuardrailSpec = (payload = {}) => {
  const planningTrack = normalizeTextKey(payload?.taxonomy?.planning_track || 'neutral');
  const branchFamily = normalizeTextKey(payload?.taxonomy?.branch_family || payload?.main_profile_category || '');
  const branchFocus = normalizeTextKey(payload?.selected_sub_category || payload?.taxonomy?.branch_focus || '');
  const mainProfileCategory = normalizeTextKey(payload?.main_profile_category || '');

  const baseReferenceTerms = [
    branchFocus,
    branchFamily,
    mainProfileCategory,
  ].filter(Boolean);

  /** @type {{referenceTerms: string[]; requiredTextTerms: string[]; requiredTargetMuscles: string[]; requiredExerciseTerms: string[]; repairHeadline: string; repairFocus: string; repairObjective: string; }} */
  const baseSpec = {
    referenceTerms: baseReferenceTerms,
    requiredTextTerms: [],
    requiredTargetMuscles: [],
    requiredExerciseTerms: [],
    repairHeadline: sanitizeText(payload?.selected_sub_category || payload?.main_profile_category, 'goal-specific'),
    repairFocus: sanitizeText(payload?.selected_sub_category || payload?.goal, 'goal-specific progression'),
    repairObjective: sanitizeText(payload?.taxonomy?.branch_rationale, 'Use onboarding branch logic as the primary training anchor.'),
  };

  if (planningTrack === 'female') {
    if (/glute/.test(branchFocus)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['glute', 'hip thrust', 'lower body', 'glute priority'],
        requiredTargetMuscles: ['Glutes'],
        requiredExerciseTerms: ['hip thrust', 'romanian deadlift', 'bulgarian split squat', 'glute bridge'],
        repairHeadline: 'glute-focused female body shaping',
        repairFocus: 'glute-priority lower body development with balanced upper support',
        repairObjective: 'Use women-specific glute-focused programming with meaningful lower-body emphasis and balanced posture work.',
      };
    }

    if (/silhouette|posture/.test(branchFocus)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['posture', 'silhouette', 'upper back', 'core stability'],
        requiredTargetMuscles: ['Back', 'Shoulders', 'Abs'],
        requiredExerciseTerms: ['row', 'face pull', 'pulldown', 'plank'],
        repairHeadline: 'silhouette and posture female shaping',
        repairFocus: 'posture-driven shaping with upper-back, glute, and core balance',
        repairObjective: 'Use women-specific silhouette and posture logic rather than generic bodybuilding structure.',
      };
    }

    if (/fat loss|fat_loss|wellness|cardio/.test(branchFocus)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['fat loss', 'conditioning', 'cardio', 'metabolic'],
        requiredTargetMuscles: ['Cardio', 'Full Body'],
        requiredExerciseTerms: ['interval', 'incline walk', 'circuit', 'sled'],
        repairHeadline: 'female fat-loss support',
        repairFocus: 'fat-loss support with strength retention and recovery-aware conditioning',
        repairObjective: 'Use women-specific fat-loss support logic with conditioning and sustainable strength work.',
      };
    }

    if (/muscle strengthening|strengthening|strength/.test(branchFocus)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['strength', 'strengthening', 'progressive overload'],
        requiredTargetMuscles: ['Glutes', 'Back', 'Shoulders', 'Quadriceps'],
        requiredExerciseTerms: ['squat', 'row', 'press', 'hinge'],
        repairHeadline: 'female strength-building',
        repairFocus: 'strength-oriented training with lower-body and posture balance',
        repairObjective: 'Use women-specific strength-building logic and do not reduce it to generic male templates.',
      };
    }

    return {
      ...baseSpec,
      requiredTextTerms: ['toning', 'shape', 'glute', 'posture'],
      requiredTargetMuscles: ['Glutes', 'Back', 'Shoulders'],
      requiredExerciseTerms: ['hinge', 'row', 'split squat'],
      repairHeadline: 'female body shaping',
      repairFocus: 'body-shaping training with lower-body emphasis and balanced upper work',
      repairObjective: 'Use women-specific body-shaping logic as the primary plan driver.',
    };
  }

  if (planningTrack === 'male') {
    if (/powerlifting|strength/.test(branchFocus)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['strength', 'compound', 'low-rep', 'intensity'],
        requiredTargetMuscles: ['Quadriceps', 'Back', 'Chest'],
        requiredExerciseTerms: ['squat', 'bench', 'deadlift', 'overhead press'],
        repairHeadline: 'male strength and powerlifting',
        repairFocus: 'compound strength progression with lower-rep primary work',
        repairObjective: 'Use men-specific strength and powerlifting logic with clear compound-lift emphasis.',
      };
    }

    if (/football|basketball|handball|swimming|combat/.test(branchFocus || branchFamily)) {
      return {
        ...baseSpec,
        requiredTextTerms: ['performance', 'power', 'conditioning', 'athletic'],
        requiredTargetMuscles: ['Full Body', 'Cardio'],
        requiredExerciseTerms: ['jump', 'carry', 'interval', 'row', 'sprint'],
        repairHeadline: 'male sport performance',
        repairFocus: 'sport-performance training with power, movement quality, and conditioning',
        repairObjective: 'Use sport-specific men\'s performance logic instead of generic hypertrophy planning.',
      };
    }

    return {
      ...baseSpec,
      requiredTextTerms: ['hypertrophy', 'muscle', 'physique', 'volume'],
      requiredTargetMuscles: ['Chest', 'Back', 'Shoulders', 'Quadriceps'],
      requiredExerciseTerms: ['press', 'row', 'curl', 'extension'],
      repairHeadline: 'male bodybuilding',
      repairFocus: 'bodybuilding-style hypertrophy with progressive volume and intensity',
      repairObjective: 'Use men-specific bodybuilding logic tied to the selected branch.',
    };
  }

  return {
    ...baseSpec,
    requiredTextTerms: [sanitizeText(payload?.goal, '', 80)],
    requiredTargetMuscles: [],
    requiredExerciseTerms: [],
    repairHeadline: sanitizeText(payload?.main_profile_category, 'goal-specific training'),
    repairFocus: sanitizeText(payload?.goal, 'goal-specific development'),
    repairObjective: 'Use the explicit onboarding branch and goal as the primary planning anchor.',
  };
};

export const validateOnboardingForClaude = (payload = {}) => {
  const issues = [];
  const planningTrack = normalizeTextKey(payload?.taxonomy?.planning_track || 'neutral');
  const selectedBranch = sanitizeText(payload?.selected_sub_category, '', 160);
  const daysPerWeek = clampInt(payload?.days_per_week, 0, 10, 0);
  const sessionMinutes = clampInt(payload?.session_duration_minutes, 0, 200, 0);

  if (!sanitizeText(payload?.goal, '', 120)) issues.push('Onboarding goal is missing.');
  if (!sanitizeText(payload?.main_profile_category, '', 120)) issues.push('Main profile category is missing.');
  if (!sanitizeText(payload?.fitness_level, '', 60)) issues.push('Fitness level is missing.');
  if (daysPerWeek < 2 || daysPerWeek > 6) issues.push('days_per_week must be between 2 and 6.');
  if (sessionMinutes < 30 || sessionMinutes > 120) issues.push('session_duration_minutes must be between 30 and 120.');

  const age = Number(payload?.age);
  if (Number.isFinite(age) && (age < 13 || age > 85)) {
    issues.push('Age is outside the supported coaching range.');
  }

  const heightCm = Number(payload?.height_cm);
  if (Number.isFinite(heightCm) && (heightCm < 120 || heightCm > 230)) {
    issues.push('Height is outside the supported coaching range.');
  }

  const weightKg = Number(payload?.weight_kg);
  if (Number.isFinite(weightKg) && (weightKg < 35 || weightKg > 300)) {
    issues.push('Weight is outside the supported coaching range.');
  }

  if ((planningTrack === 'female' || planningTrack === 'male') && !selectedBranch) {
    issues.push('A selected onboarding branch is required for gender-specific plan generation.');
  }

  return issues;
};

const buildFallbackExercises = (spec, dayIndex) => {
  const focus = normalizeTextKey(spec.repairFocus);
  if (/glute/.test(focus)) {
    return [
      { name: 'Barbell Hip Thrust', targetMuscles: ['Glutes', 'Hamstrings'], sets: 4, reps: '8-10', restSeconds: 90, notes: 'Drive through full hip extension.' },
      { name: 'Romanian Deadlift', targetMuscles: ['Glutes', 'Hamstrings'], sets: 3, reps: '8-10', restSeconds: 90, notes: 'Use a controlled hinge pattern.' },
      { name: 'Bulgarian Split Squat', targetMuscles: ['Glutes', 'Quadriceps'], sets: 3, reps: '10-12', restSeconds: 75, notes: 'Bias depth and hip control.' },
    ];
  }
  if (/posture|silhouette/.test(focus)) {
    return [
      { name: 'Seated Cable Row', targetMuscles: ['Back'], sets: 4, reps: '8-12', restSeconds: 75, notes: 'Lead with the elbows and chest up.' },
      { name: 'Face Pull', targetMuscles: ['Back', 'Shoulders'], sets: 3, reps: '12-15', restSeconds: 60, notes: 'Emphasize scapular control.' },
      { name: 'Plank', targetMuscles: ['Abs'], sets: 3, reps: '30-45 sec', restSeconds: 45, notes: 'Brace through the full set.' },
    ];
  }
  if (/fat-loss|fat loss|conditioning|cardio/.test(focus)) {
    return [
      { name: 'Goblet Squat', targetMuscles: ['Full Body'], sets: 3, reps: '10-12', restSeconds: 60, notes: 'Move with intent and keep rest honest.' },
      { name: 'Incline Walk Intervals', targetMuscles: ['Cardio'], sets: 1, reps: '15-20 min', restSeconds: 0, notes: 'Keep pace sustainable but challenging.' },
      { name: 'Dumbbell Row', targetMuscles: ['Back'], sets: 3, reps: '10-12', restSeconds: 60, notes: 'Stay crisp under fatigue.' },
    ];
  }
  if (/strength|powerlifting/.test(focus)) {
    return [
      { name: dayIndex % 3 === 0 ? 'Back Squat' : dayIndex % 3 === 1 ? 'Bench Press' : 'Deadlift', targetMuscles: ['Quadriceps', 'Chest', 'Back'], sets: 4, reps: '4-6', restSeconds: 150, notes: 'Keep bar speed clean and technical.' },
      { name: 'Barbell Row', targetMuscles: ['Back'], sets: 4, reps: '6-8', restSeconds: 120, notes: 'Build upper-back stability.' },
      { name: 'Overhead Press', targetMuscles: ['Shoulders'], sets: 3, reps: '5-8', restSeconds: 120, notes: 'Stay braced through each rep.' },
    ];
  }
  if (/sport-performance|athletic|performance/.test(focus)) {
    return [
      { name: 'Trap Bar Deadlift', targetMuscles: ['Full Body'], sets: 4, reps: '4-6', restSeconds: 120, notes: 'Prioritize power and crisp setup.' },
      { name: 'Box Jump', targetMuscles: ['Full Body'], sets: 3, reps: '4-6', restSeconds: 75, notes: 'Land softly and reset each rep.' },
      { name: 'Rowing Intervals', targetMuscles: ['Cardio'], sets: 1, reps: '10-15 min', restSeconds: 0, notes: 'Keep output repeatable.' },
    ];
  }

  return [
    { name: 'Primary Compound Lift', targetMuscles: ['Full Body'], sets: 4, reps: '6-8', restSeconds: 120, notes: 'Use crisp, controlled reps.' },
    { name: 'Secondary Compound Lift', targetMuscles: ['Full Body'], sets: 3, reps: '8-10', restSeconds: 90, notes: 'Stay one to three reps from failure.' },
    { name: 'Accessory Lift', targetMuscles: ['Full Body'], sets: 3, reps: '10-12', restSeconds: 75, notes: 'Use full range and consistent tempo.' },
  ];
};

const buildFallbackWorkoutDays = (payload, spec) => {
  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  const targetDuration = clampInt(payload?.session_duration_minutes, 30, 120, 60);
  return CANONICAL_WEEK_DAYS.slice(0, requestedDays).map((dayName, index) => ({
    dayName,
    sessionName: `${sanitizeText(spec.repairHeadline, 'Goal-specific')} Day ${index + 1}`,
    workoutName: `${sanitizeText(spec.repairHeadline, 'Goal-specific')} Day ${index + 1}`,
    workoutType: /strength|powerlifting/.test(normalizeTextKey(spec.repairFocus))
      ? index % 2 === 0 ? 'Upper Body' : 'Lower Body'
      : /glute/.test(normalizeTextKey(spec.repairFocus))
        ? index % 2 === 0 ? 'Lower Body' : 'Upper Body'
        : 'Full Body',
    focus: sanitizeText(spec.repairFocus, 'Goal-specific progression'),
    estimatedDurationMinutes: targetDuration,
    notes: sanitizeText(spec.repairObjective, '', 220),
    exercises: buildFallbackExercises(spec, index),
  }));
};

const ensureDuration = (value, targetDuration) => {
  const min = Math.max(25, targetDuration - 15);
  const max = Math.min(120, targetDuration + 15);
  return clampInt(value, min, max, targetDuration);
};

const repairWorkoutDay = (workout, fallbackWorkout, payload, spec, dayIndex) => {
  const targetDuration = clampInt(payload?.session_duration_minutes, 30, 120, 60);
  const exercises = toArray(workout?.exercises)
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 10)
    .map((exercise, exerciseIndex) => ({
      name: sanitizeText(exercise?.name, fallbackWorkout.exercises[exerciseIndex]?.name || `Exercise ${exerciseIndex + 1}`, 120),
      targetMuscles: toArray(exercise?.targetMuscles).length
        ? toArray(exercise.targetMuscles).map((item) => sanitizeText(item, '', 40)).filter(Boolean).slice(0, 3)
        : fallbackWorkout.exercises[exerciseIndex]?.targetMuscles || [],
      sets: clampInt(exercise?.sets, 1, 8, fallbackWorkout.exercises[exerciseIndex]?.sets || 3),
      reps: sanitizeText(exercise?.reps, fallbackWorkout.exercises[exerciseIndex]?.reps || '8-12', 32),
      restSeconds: clampInt(exercise?.restSeconds, 15, 240, fallbackWorkout.exercises[exerciseIndex]?.restSeconds || 75),
      tempo: sanitizeText(exercise?.tempo, '', 20) || null,
      rpeTarget: Number.isFinite(Number(exercise?.rpeTarget))
        ? Number(Number(exercise.rpeTarget).toFixed(1))
        : null,
      notes: sanitizeText(exercise?.notes, fallbackWorkout.exercises[exerciseIndex]?.notes || '', 220),
    }));

  while (exercises.length < 2) {
    const fallbackExercise = fallbackWorkout.exercises[exercises.length] || fallbackWorkout.exercises[0];
    exercises.push(cloneJson(fallbackExercise));
  }

  return {
    dayName: normalizeDayName(workout?.dayName, dayIndex),
    sessionName: sanitizeText(workout?.sessionName || workout?.workoutName, fallbackWorkout.sessionName, 120),
    workoutName: sanitizeText(workout?.workoutName || workout?.sessionName, fallbackWorkout.workoutName, 120),
    workoutType: sanitizeText(workout?.workoutType, fallbackWorkout.workoutType, 80),
    focus: sanitizeText(workout?.focus, fallbackWorkout.focus, 180),
    estimatedDurationMinutes: ensureDuration(workout?.estimatedDurationMinutes, targetDuration),
    notes: sanitizeText(workout?.notes, fallbackWorkout.notes, 220),
    exercises,
  };
};

const collectReferenceWorkouts = (plan, payload, spec) => {
  const byPhase = toArray(plan?.workoutsByPhase)
    .flatMap((phase) => toArray(phase?.workouts))
    .filter((workout) => workout && typeof workout === 'object' && toArray(workout.exercises).length > 0);
  const byWeekly = toArray(plan?.weeklySchedule)
    .filter((workout) => workout && typeof workout === 'object' && toArray(workout.exercises).length > 0);

  const source = [...byPhase, ...byWeekly].slice(0, clampInt(payload?.days_per_week, 2, 6, 4));
  if (source.length > 0) return source;
  return buildFallbackWorkoutDays(payload, spec);
};

const buildDefaultStrategies = (payload, spec) =>
  AI_PLAN_PHASE_BLUEPRINT.map((phase) => ({
    weekRange: { start: phase.startWeek, end: phase.endWeek },
    title: phase.label,
    details: `${spec.repairObjective} Weeks ${phase.startWeek}-${phase.endWeek} should progress while matching ${clampInt(payload?.days_per_week, 2, 6, 4)} training days.`,
  }));

const collectBranchSignals = (plan, spec) => {
  const texts = [
    plan?.programOverview,
    plan?.coachingInterpretation,
    plan?.summary,
    plan?.goalMatch,
    plan?.finalCoachMessage,
    ...toArray(plan?.weeklySplit).flatMap((split) => [split?.splitName, split?.rationale]),
    ...toArray(plan?.workoutsByPhase).flatMap((phase) => [
      phase?.phaseName,
      phase?.objective,
      ...toArray(phase?.workouts).flatMap((workout) => [
        workout?.sessionName,
        workout?.workoutName,
        workout?.focus,
        workout?.notes,
        ...toArray(workout?.exercises).flatMap((exercise) => [exercise?.name, exercise?.notes]),
      ]),
    ]),
  ]
    .map((item) => normalizeTextKey(item))
    .filter(Boolean)
    .join(' ');

  const allTargetMuscles = toArray(plan?.workoutsByPhase)
    .flatMap((phase) => toArray(phase?.workouts))
    .flatMap((workout) => toArray(workout?.exercises))
    .flatMap((exercise) => toArray(exercise?.targetMuscles))
    .map((item) => sanitizeText(item, '', 40));

  const textSignals = new Set(
    [...spec.referenceTerms, ...spec.requiredTextTerms, ...spec.requiredExerciseTerms]
      .map((item) => normalizeTextKey(item))
      .filter(Boolean)
      .filter((item) => texts.includes(item)),
  );

  const targetSignals = new Set(
    spec.requiredTargetMuscles.filter((item) => allTargetMuscles.includes(item)),
  );

  return {
    textSignals: Array.from(textSignals),
    targetSignals: Array.from(targetSignals),
    totalSignals: textSignals.size + targetSignals.size,
  };
};

export const enforceEightWeekCoverage = (phases) => {
  const normalizedPhases = toArray(phases);
  const expected = getExpectedWeekRanges();
  if (normalizedPhases.length !== expected.length) return false;

  const coveredWeeks = new Set();
  normalizedPhases.forEach((phase) => {
    const start = clampInt(phase?.weekRange?.start, 1, AI_TRAINING_PLAN_DURATION_WEEKS, 1);
    const end = clampInt(phase?.weekRange?.end, start, AI_TRAINING_PLAN_DURATION_WEEKS, start);
    for (let week = start; week <= end; week += 1) {
      coveredWeeks.add(week);
    }
  });

  if (coveredWeeks.size !== AI_TRAINING_PLAN_DURATION_WEEKS) return false;

  return expected.every((entry, index) => {
    const phase = normalizedPhases[index];
    return phase
      && Number(phase?.weekRange?.start) === entry.weekRange.start
      && Number(phase?.weekRange?.end) === entry.weekRange.end;
  });
};

export const validateScheduleConsistency = (plan, payload) => {
  const issues = [];
  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  const targetDuration = clampInt(payload?.session_duration_minutes, 30, 120, 60);
  const minDuration = Math.max(25, targetDuration - 15);
  const maxDuration = Math.min(120, targetDuration + 15);

  toArray(plan?.workoutsByPhase).forEach((phase, phaseIndex) => {
    const workouts = toArray(phase?.workouts);
    if (workouts.length !== requestedDays) {
      issues.push(`Phase ${phaseIndex + 1} does not contain exactly ${requestedDays} workouts.`);
    }

    workouts.forEach((workout, workoutIndex) => {
      const duration = Number(workout?.estimatedDurationMinutes || 0);
      if (!Number.isFinite(duration) || duration < minDuration || duration > maxDuration) {
        issues.push(`Phase ${phaseIndex + 1} workout ${workoutIndex + 1} duration is inconsistent with session target.`);
      }
      if (toArray(workout?.exercises).length < 2) {
        issues.push(`Phase ${phaseIndex + 1} workout ${workoutIndex + 1} has too few exercises.`);
      }
    });
  });

  toArray(plan?.weeklySplit).forEach((entry, splitIndex) => {
    if (toArray(entry?.trainingDays).length !== requestedDays) {
      issues.push(`Weekly split phase ${splitIndex + 1} does not match requested training days.`);
    }
  });

  return issues;
};

export const repairNormalizedPlan = (plan, payload = {}) => {
  const spec = buildBranchGuardrailSpec(payload);
  const repaired = cloneJson(plan || {});
  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  const targetDuration = clampInt(payload?.session_duration_minutes, 30, 120, 60);
  const referenceWorkouts = collectReferenceWorkouts(repaired, payload, spec);
  const fallbackWorkouts = buildFallbackWorkoutDays(payload, spec);

  repaired.userSummary = {
    ...(repaired.userSummary || {}),
    name: sanitizeText(repaired?.userSummary?.name, payload?.name, 80) || null,
    goal: sanitizeText(repaired?.userSummary?.goal, payload?.goal, 120),
    fitnessLevel: sanitizeText(repaired?.userSummary?.fitnessLevel, payload?.fitness_level, 60),
    mainProfileCategory: sanitizeText(repaired?.userSummary?.mainProfileCategory, payload?.main_profile_category, 120),
    selectedSubCategory: sanitizeText(repaired?.userSummary?.selectedSubCategory, payload?.selected_sub_category, 160) || null,
    daysPerWeek: requestedDays,
    sessionDurationMinutes: targetDuration,
  };

  repaired.workoutsByPhase = AI_PLAN_PHASE_BLUEPRINT.map((blueprint, phaseIndex) => {
    const rawPhase = toArray(repaired?.workoutsByPhase)[phaseIndex] || {};
    const sourceWorkouts = toArray(rawPhase?.workouts);
    const workouts = [];

    for (let workoutIndex = 0; workoutIndex < requestedDays; workoutIndex += 1) {
      const sourceWorkout = sourceWorkouts[workoutIndex] || referenceWorkouts[workoutIndex] || fallbackWorkouts[workoutIndex];
      const fallbackWorkout = fallbackWorkouts[workoutIndex] || fallbackWorkouts[0];
      workouts.push(repairWorkoutDay(sourceWorkout, fallbackWorkout, payload, spec, workoutIndex));
    }

    return {
      phaseName: sanitizeText(rawPhase?.phaseName, blueprint.label, 120),
      weekRange: { start: blueprint.startWeek, end: blueprint.endWeek },
      objective: sanitizeText(rawPhase?.objective, `${spec.repairObjective} ${blueprint.label} phase.`, 220),
      workouts,
    };
  });

  repaired.weeklySplit = AI_PLAN_PHASE_BLUEPRINT.map((blueprint, phaseIndex) => {
    const rawSplit = toArray(repaired?.weeklySplit)[phaseIndex] || {};
    const phase = repaired.workoutsByPhase[phaseIndex];
    return {
      weekRange: { start: blueprint.startWeek, end: blueprint.endWeek },
      splitName: sanitizeText(rawSplit?.splitName, `${phase.phaseName} Split`, 120),
      rationale: sanitizeText(rawSplit?.rationale, phase.objective, 220),
      trainingDays: phase.workouts.map((workout) => ({
        dayName: workout.dayName,
        sessionName: workout.sessionName,
        workoutType: workout.workoutType,
        focus: workout.focus,
        estimatedDurationMinutes: workout.estimatedDurationMinutes,
      })),
    };
  });

  repaired.weeklySchedule = repaired.workoutsByPhase[0]?.workouts || fallbackWorkouts;
  repaired.programOverview = sanitizeText(
    repaired?.programOverview,
    `A branch-specific ${AI_TRAINING_PLAN_DURATION_WEEKS}-week program for ${spec.repairHeadline}.`,
    320,
  );
  repaired.summary = sanitizeText(repaired?.summary, repaired.programOverview, 320);
  repaired.coachingInterpretation = sanitizeText(
    repaired?.coachingInterpretation,
    spec.repairObjective,
    320,
  );
  repaired.goalMatch = sanitizeText(repaired?.goalMatch, repaired.coachingInterpretation, 320);
  repaired.photoAnalysisSummary = sanitizeText(
    repaired?.photoAnalysisSummary,
    payload?.photo_analysis_summary_or_null,
    420,
  ) || null;
  repaired.progressionStrategy = toArray(repaired?.progressionStrategy).length
    ? toArray(repaired.progressionStrategy)
    : buildDefaultStrategies(payload, spec);
  repaired.recoveryStrategy = toArray(repaired?.recoveryStrategy).length
    ? toArray(repaired.recoveryStrategy)
    : [
        { weekRange: null, title: 'Recovery Bias', details: `Match recovery to ${requestedDays} days per week and ${targetDuration}-minute sessions.` },
        { weekRange: null, title: 'Movement Quality', details: 'Prioritize technical execution and leave room for sustainable progression.' },
      ];
  repaired.coachNotes = toArray(repaired?.coachNotes).length
    ? toArray(repaired.coachNotes)
    : [
        { weekRange: null, title: 'Branch Logic', details: spec.repairObjective },
      ];
  repaired.finalCoachMessage = sanitizeText(
    repaired?.finalCoachMessage,
    `Stay consistent with the ${spec.repairHeadline} plan and progress each phase with control.`,
    320,
  );
  repaired.progressionRules = toArray(repaired?.progressionStrategy).map((item) =>
    sanitizeText(
      `${item?.weekRange ? `Weeks ${item.weekRange.start}-${item.weekRange.end}` : sanitizeText(item?.title, 'Progression', 80)}: ${item?.details || ''}`,
      '',
      260,
    )).filter(Boolean);
  repaired.recoveryRules = toArray(repaired?.recoveryStrategy).map((item) =>
    sanitizeText(`${sanitizeText(item?.title, 'Recovery', 80)}: ${item?.details || ''}`, '', 260)).filter(Boolean);
  repaired.checkpoints = AI_PLAN_PHASE_BLUEPRINT.map((phase, index) => ({
    week: phase.endWeek,
    target: sanitizeText(
      repaired?.progressionStrategy?.[index]?.details,
      `${phase.label} milestone for ${spec.repairHeadline}.`,
      180,
    ),
  }));

  const signals = collectBranchSignals(repaired, spec);
  if (signals.totalSignals === 0) {
    repaired.programOverview = sanitizeText(`${repaired.programOverview} This plan specifically follows ${spec.repairHeadline} logic.`, repaired.programOverview, 320);
    repaired.coachingInterpretation = sanitizeText(`${repaired.coachingInterpretation} ${spec.repairObjective}`, repaired.coachingInterpretation, 320);
    repaired.workoutsByPhase[0].objective = sanitizeText(`${repaired.workoutsByPhase[0].objective} ${spec.repairObjective}`, repaired.workoutsByPhase[0].objective, 220);
    repaired.workoutsByPhase[0].workouts[0].focus = sanitizeText(spec.repairFocus, repaired.workoutsByPhase[0].workouts[0].focus, 180);
    repaired.weeklySplit[0].rationale = sanitizeText(spec.repairObjective, repaired.weeklySplit[0].rationale, 220);
  }

  return repaired;
};

export const validateNormalizedPlan = (plan, payload = {}) => {
  const issues = [];
  const repairedPlan = repairNormalizedPlan(plan, payload);
  const requestedDays = clampInt(payload?.days_per_week, 2, 6, 4);
  const spec = buildBranchGuardrailSpec(payload);

  if (!enforceEightWeekCoverage(repairedPlan?.workoutsByPhase)) {
    issues.push('Plan does not cover exactly 8 weeks with the required phase structure.');
  }

  issues.push(...validateScheduleConsistency(repairedPlan, payload));

  if (toArray(repairedPlan?.workoutsByPhase).length !== AI_PLAN_PHASE_BLUEPRINT.length) {
    issues.push('Plan must contain exactly four 2-week phases.');
  }

  if (toArray(repairedPlan?.weeklySchedule).length !== requestedDays) {
    issues.push('Weekly schedule does not match days_per_week.');
  }

  if (toArray(repairedPlan?.progressionStrategy).length === 0) {
    issues.push('Progression strategy is missing.');
  }
  if (toArray(repairedPlan?.recoveryStrategy).length === 0) {
    issues.push('Recovery strategy is missing.');
  }

  const branchSignals = collectBranchSignals(repairedPlan, spec);
  const requiresStrictBranchSignal = ['female', 'male'].includes(normalizeTextKey(payload?.taxonomy?.planning_track));
  if (requiresStrictBranchSignal && branchSignals.totalSignals < 2) {
    issues.push('Plan does not preserve the required branch-specific logic strongly enough.');
  }

  const repProfileNeedsStrength = /strength|powerlifting/.test(normalizeTextKey(spec.repairFocus));
  if (repProfileNeedsStrength) {
    const hasLowRepPrimaryWork = toArray(repairedPlan?.workoutsByPhase)
      .flatMap((phase) => toArray(phase?.workouts))
      .flatMap((workout) => toArray(workout?.exercises))
      .some((exercise) => {
        const range = parseRepRange(exercise?.reps);
        return range.max != null && range.max <= 6;
      });
    if (!hasLowRepPrimaryWork) {
      issues.push('Strength-oriented branch is missing low-rep primary work.');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    repairedPlan,
  };
};
