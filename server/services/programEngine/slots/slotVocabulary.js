export const SLOT_ROLES = Object.freeze([
  'primary_compound',
  'secondary_compound',
  'accessory',
  'isolation',
  'core',
  'conditioning',
  'recovery',
]);

export const MOVEMENT_PATTERNS = Object.freeze([
  'horizontal_press',
  'incline_press',
  'vertical_press',
  'vertical_pull',
  'horizontal_pull',
  'upper_back',
  'rear_delt',
  'squat_pattern',
  'bench',
  'deadlift',
  'hip_hinge',
  'hip_hinge_accessory',
  'single_leg',
  'quad_accessory',
  'hamstring_accessory',
  'chest_isolation',
  'shoulder',
  'lateral_delt',
  'triceps',
  'biceps',
  'calves',
  'core',
  'easy_aerobic',
  'long_aerobic',
  'tempo',
  'interval',
  'recovery',
  'resistance_circuit',
]);

export const MUSCLE_GROUPS = Object.freeze([
  'chest',
  'back',
  'shoulders',
  'triceps',
  'biceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'upper_back',
  'full_body',
  'cardiorespiratory',
]);

export const SLOT_VOCABULARY = Object.freeze({
  roles: SLOT_ROLES,
  movementPatterns: MOVEMENT_PATTERNS,
  primaryMuscleGroups: MUSCLE_GROUPS,
});

export const isKnownSlot = (slot) =>
  MOVEMENT_PATTERNS.includes(slot?.movementPattern)
  && MUSCLE_GROUPS.includes(slot?.primaryMuscleGroup)
  && SLOT_ROLES.includes(slot?.role)
  && Number.isInteger(slot?.priority)
  && slot.priority >= 1
  && slot.priority <= 3;
