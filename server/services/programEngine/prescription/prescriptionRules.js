const EXPERIENCE_SET_ADJUSTMENT = Object.freeze({
  beginner: -1,
  intermediate: 0,
  advanced: 1,
});

const RECOVERY_SET_ADJUSTMENT = Object.freeze({
  balanced: 0,
  recovery: -1,
  conservative: -1,
  performance: 1,
  push_progression: 1,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const reps = (min, max) => ({ type: 'range', min, max });

const baseResistance = (slot) => {
  if (slot.role === 'primary_compound') return { sets: 4, reps: reps(5, 10), rir: 2, restSeconds: 150 };
  if (slot.role === 'secondary_compound') return { sets: 3, reps: reps(6, 12), rir: 2, restSeconds: 120 };
  if (slot.role === 'accessory') return { sets: 3, reps: reps(8, 15), rir: 2, restSeconds: 90 };
  if (slot.role === 'isolation') return { sets: 2, reps: reps(10, 20), rir: 2, restSeconds: 60 };
  if (slot.role === 'core') return { sets: 2, reps: reps(10, 15), rir: 3, restSeconds: 45 };
  return { sets: 2, reps: reps(8, 12), rir: 2, restSeconds: 90 };
};

const applySetModifiers = (sets, { experience, recoveryStrategy, slot }) => {
  const optionalPenalty = slot.required ? 0 : -1;
  return clamp(
    sets + (EXPERIENCE_SET_ADJUSTMENT[experience] ?? 0) + (RECOVERY_SET_ADJUSTMENT[recoveryStrategy] ?? 0) + optionalPenalty,
    1,
    6,
  );
};

const powerliftingBase = (slot) => {
  if (slot.movementPattern === 'bench') return { sets: 4, reps: reps(3, 6), rir: 2, restSeconds: 180 };
  if (slot.movementPattern === 'squat_pattern') return { sets: 4, reps: reps(3, 6), rir: 2, restSeconds: 180 };
  if (slot.movementPattern === 'deadlift') return { sets: 3, reps: reps(2, 5), rir: 2, restSeconds: 210 };
  const base = baseResistance(slot);
  return { ...base, reps: slot.role === 'isolation' ? reps(10, 15) : reps(6, 10), restSeconds: Math.max(base.restSeconds, 90) };
};

const cuttingBase = (slot) => {
  const base = baseResistance(slot);
  return {
    ...base,
    sets: Math.max(1, base.sets - (slot.required ? 0 : 1)),
    rir: 3,
  };
};

export const prescribeResistanceSlot = ({
  goal,
  experience,
  recoveryStrategy,
  slot,
  weekNumber,
}) => {
  const template = goal === 'powerlifting'
    ? powerliftingBase(slot)
    : goal === 'cutting'
      ? cuttingBase(slot)
      : baseResistance(slot);

  let sets = applySetModifiers(template.sets, { experience, recoveryStrategy, slot });
  if (weekNumber === 5) sets = Math.max(1, sets - 1);

  const effortTarget = weekNumber === 1
    ? template.rir + 1
    : weekNumber === 8
      ? Math.max(1, template.rir - 1)
      : template.rir;

  return {
    sets,
    reps: template.reps,
    effort: {
      type: 'rir',
      target: clamp(effortTarget, 1, 4),
    },
    restSeconds: template.restSeconds,
    progressionRule: goal === 'powerlifting'
      ? 'strength_rir_progression_no_load_percentages'
      : 'double_progression_top_of_range_at_target_rir',
  };
};

export const prescribeCardioSlot = ({
  movementPattern,
  goal,
  sessionDurationMinutes,
  weekNumber,
}) => {
  const deloadMultiplier = weekNumber === 5 ? 0.8 : 1;
  const buildMultiplier = weekNumber >= 6 ? 1.1 : weekNumber >= 2 ? 1.05 : 1;
  const safeDuration = (minutes) => Math.max(10, Math.round(minutes * deloadMultiplier * buildMultiplier));

  if (movementPattern === 'long_aerobic') {
    return {
      type: 'cardio',
      modality: 'user_selectable',
      durationMinutes: safeDuration(Math.max(30, sessionDurationMinutes * 0.9)),
      intensity: { type: 'rpe', target: 5 },
      sessionPurpose: 'long_aerobic_base',
    };
  }
  if (movementPattern === 'tempo') {
    return {
      type: 'cardio',
      modality: 'user_selectable',
      durationMinutes: safeDuration(Math.max(20, sessionDurationMinutes * 0.7)),
      intensity: { type: 'rpe', target: 7 },
      sessionPurpose: 'controlled_tempo',
    };
  }
  if (movementPattern === 'interval') {
    return {
      type: 'cardio',
      modality: 'user_selectable',
      durationMinutes: safeDuration(Math.max(20, sessionDurationMinutes * 0.65)),
      intensity: { type: 'interval_rpe', workTarget: 8, recoveryTarget: 3 },
      intervals: { rounds: weekNumber === 5 ? 4 : 6, workSeconds: 60, recoverySeconds: 90 },
      sessionPurpose: 'structured_intervals',
    };
  }
  if (movementPattern === 'recovery') {
    return {
      type: 'cardio',
      modality: 'user_selectable',
      durationMinutes: safeDuration(Math.max(15, sessionDurationMinutes * 0.5)),
      intensity: { type: 'rpe', target: 3 },
      sessionPurpose: 'low_stress_recovery',
    };
  }

  return {
    type: 'cardio',
    modality: 'user_selectable',
    durationMinutes: safeDuration(goal === 'fat_loss' ? Math.max(15, sessionDurationMinutes * 0.45) : Math.max(20, sessionDurationMinutes * 0.65)),
    intensity: { type: 'rpe', target: goal === 'fat_loss' ? 6 : 4 },
    sessionPurpose: movementPattern === 'resistance_circuit' ? 'conditioning_circuit' : 'easy_aerobic_base',
  };
};
