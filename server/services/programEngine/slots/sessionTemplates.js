import {
  RECOVERY_SLOT_ADJUSTMENTS,
  SLOT_LIMITS_BY_DURATION,
} from '../config/engineConfig.js';

const slot = (movementPattern, primaryMuscleGroup, role, priority = 2, required = true) => ({
  movementPattern,
  primaryMuscleGroup,
  role,
  priority,
  required,
});

const TEMPLATES = Object.freeze({
  full_body_a: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('horizontal_press', 'chest', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'secondary_compound', 1),
    slot('hip_hinge', 'hamstrings', 'secondary_compound', 2),
    slot('shoulder', 'shoulders', 'accessory', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  full_body_b: [
    slot('hip_hinge', 'hamstrings', 'primary_compound', 1),
    slot('vertical_press', 'shoulders', 'primary_compound', 1),
    slot('vertical_pull', 'back', 'secondary_compound', 1),
    slot('single_leg', 'glutes', 'accessory', 2),
    slot('biceps', 'biceps', 'isolation', 3, false),
    slot('triceps', 'triceps', 'isolation', 3, false),
  ],
  full_body_c: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('incline_press', 'chest', 'secondary_compound', 1),
    slot('horizontal_pull', 'upper_back', 'secondary_compound', 1),
    slot('hip_hinge_accessory', 'hamstrings', 'accessory', 2),
    slot('lateral_delt', 'shoulders', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  push: [
    slot('horizontal_press', 'chest', 'primary_compound', 1),
    slot('incline_press', 'chest', 'secondary_compound', 1),
    slot('vertical_press', 'shoulders', 'secondary_compound', 2),
    slot('chest_isolation', 'chest', 'isolation', 2),
    slot('lateral_delt', 'shoulders', 'isolation', 3, false),
    slot('triceps', 'triceps', 'isolation', 3, false),
  ],
  pull: [
    slot('vertical_pull', 'back', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'primary_compound', 1),
    slot('upper_back', 'upper_back', 'accessory', 2),
    slot('rear_delt', 'shoulders', 'isolation', 2),
    slot('biceps', 'biceps', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  legs: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('hip_hinge', 'hamstrings', 'secondary_compound', 1),
    slot('quad_accessory', 'quadriceps', 'accessory', 2),
    slot('hamstring_accessory', 'hamstrings', 'accessory', 2),
    slot('calves', 'calves', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  upper: [
    slot('horizontal_press', 'chest', 'primary_compound', 1),
    slot('vertical_pull', 'back', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'secondary_compound', 1),
    slot('shoulder', 'shoulders', 'accessory', 2),
    slot('biceps', 'biceps', 'isolation', 3, false),
    slot('triceps', 'triceps', 'isolation', 3, false),
  ],
  lower: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('hip_hinge', 'hamstrings', 'primary_compound', 1),
    slot('single_leg', 'glutes', 'accessory', 2),
    slot('quad_accessory', 'quadriceps', 'accessory', 2),
    slot('hamstring_accessory', 'hamstrings', 'accessory', 3, false),
    slot('calves', 'calves', 'isolation', 3, false),
  ],
  pl_squat_bench: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('bench', 'chest', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'secondary_compound', 2),
    slot('quad_accessory', 'quadriceps', 'accessory', 2),
    slot('triceps', 'triceps', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  pl_deadlift_bench: [
    slot('deadlift', 'hamstrings', 'primary_compound', 1),
    slot('bench', 'chest', 'primary_compound', 1),
    slot('upper_back', 'upper_back', 'accessory', 2),
    slot('hip_hinge_accessory', 'hamstrings', 'accessory', 2),
    slot('rear_delt', 'shoulders', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  pl_bench_upper: [
    slot('bench', 'chest', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'secondary_compound', 1),
    slot('vertical_pull', 'back', 'secondary_compound', 2),
    slot('vertical_press', 'shoulders', 'secondary_compound', 2),
    slot('triceps', 'triceps', 'isolation', 3, false),
    slot('rear_delt', 'shoulders', 'isolation', 3, false),
  ],
  pl_lower: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('deadlift', 'hamstrings', 'primary_compound', 1),
    slot('single_leg', 'glutes', 'accessory', 2),
    slot('hamstring_accessory', 'hamstrings', 'accessory', 2),
    slot('calves', 'calves', 'isolation', 3, false),
    slot('core', 'core', 'core', 3, false),
  ],
  fat_loss_resistance: [
    slot('squat_pattern', 'quadriceps', 'primary_compound', 1),
    slot('horizontal_press', 'chest', 'primary_compound', 1),
    slot('horizontal_pull', 'back', 'secondary_compound', 1),
    slot('hip_hinge', 'hamstrings', 'secondary_compound', 2),
    slot('core', 'core', 'core', 2),
    slot('easy_aerobic', 'cardiorespiratory', 'conditioning', 3, false),
  ],
  fat_loss_cardio: [
    slot('easy_aerobic', 'cardiorespiratory', 'conditioning', 1),
    slot('resistance_circuit', 'full_body', 'conditioning', 2),
    slot('core', 'core', 'core', 3, false),
  ],
  easy_aerobic: [slot('easy_aerobic', 'cardiorespiratory', 'conditioning', 1)],
  long_aerobic: [slot('long_aerobic', 'cardiorespiratory', 'conditioning', 1)],
  tempo: [slot('tempo', 'cardiorespiratory', 'conditioning', 1)],
  interval: [slot('interval', 'cardiorespiratory', 'conditioning', 1)],
  recovery: [slot('recovery', 'cardiorespiratory', 'recovery', 1)],
});

const getSlotLimit = ({ sessionDurationMinutes, experience, recoveryStrategy }) => {
  const base = SLOT_LIMITS_BY_DURATION[sessionDurationMinutes]?.[experience] ?? 5;
  const adjustment = RECOVERY_SLOT_ADJUSTMENTS[recoveryStrategy] ?? 0;
  return Math.max(1, Math.min(8, base + adjustment));
};

export const buildSessionSlots = ({
  sessionType,
  sessionIndex,
  sessionDurationMinutes,
  experience,
  recoveryStrategy = 'balanced',
  trainingFocus = 'balanced',
}) => {
  const template = TEMPLATES[sessionType];
  if (!template) return [];

  const adjusted = template.map((entry) => {
    let priority = entry.priority;
    if (trainingFocus === 'strength' && ['primary_compound', 'secondary_compound'].includes(entry.role)) {
      priority = Math.max(1, priority - 1);
    }
    if (trainingFocus === 'hypertrophy' && ['accessory', 'isolation'].includes(entry.role)) {
      priority = Math.max(1, priority - 1);
    }
    return { ...entry, priority };
  });

  const required = adjusted.filter((entry) => entry.required);
  const optional = adjusted
    .filter((entry) => !entry.required)
    .sort((left, right) => left.priority - right.priority);
  const limit = Math.max(required.length, getSlotLimit({ sessionDurationMinutes, experience, recoveryStrategy }));

  return [...required, ...optional]
    .slice(0, limit)
    .map((entry, index) => ({
      slotId: `${sessionType}_${sessionIndex + 1}_${index + 1}`,
      ...entry,
    }));
};

export const SESSION_TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
