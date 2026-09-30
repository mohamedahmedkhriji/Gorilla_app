export const PROGRAM_ENGINE_VERSION = '1.0';

export const DEFAULT_PROGRAM_LENGTH_WEEKS = 8;

export const SUPPORTED_BLUEPRINT_GOALS = Object.freeze([
  'hypertrophy',
  'powerlifting',
  'cutting',
  'bulking',
  'fat_loss',
  'endurance',
]);

export const SUPPORTED_SPLIT_IDS = Object.freeze([
  'full_body_ab',
  'full_body_abc',
  'upper_lower',
  'ppl_upper_lower',
  'ppl_x2',
  'powerlifting_2_day',
  'powerlifting_3_day',
  'powerlifting_4_day',
  'powerlifting_5_day',
  'powerlifting_6_day',
  'fat_loss_2_day',
  'fat_loss_3_day',
  'fat_loss_4_day',
  'fat_loss_5_day',
  'endurance_2_day',
  'endurance_3_day',
  'endurance_4_day',
  'endurance_5_day',
  'endurance_6_day',
]);

export const SUPPORTED_SESSION_DURATIONS = Object.freeze([30, 45, 60, 90]);

export const SLOT_LIMITS_BY_DURATION = Object.freeze({
  30: { beginner: 4, intermediate: 4, advanced: 5 },
  45: { beginner: 5, intermediate: 5, advanced: 6 },
  60: { beginner: 5, intermediate: 6, advanced: 7 },
  90: { beginner: 6, intermediate: 7, advanced: 8 },
});

export const RECOVERY_SLOT_ADJUSTMENTS = Object.freeze({
  balanced: 0,
  recovery: -1,
  conservative: -1,
  performance: 1,
  push_progression: 1,
});
