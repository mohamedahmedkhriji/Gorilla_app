// @ts-check

export const AI_TRAINING_PLAN_SCHEMA_VERSION = '2026-04-13';
export const AI_TRAINING_PLAN_DURATION_WEEKS = 8;
export const AI_PLAN_PHASE_BLUEPRINT = [
  { startWeek: 1, endWeek: 2, label: 'Foundation' },
  { startWeek: 3, endWeek: 4, label: 'Build' },
  { startWeek: 5, endWeek: 6, label: 'Progression' },
  { startWeek: 7, endWeek: 8, label: 'Peak And Consolidation' },
];

export const MAX_INCLUDED_IMAGES = 3;
export const MAX_IMAGE_BYTES = 3_500_000;
export const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_TARGET_MUSCLES = [
  'Chest',
  'Back',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Calves',
  'Abs',
  'Adductors',
  'Abductors',
  'Cardio',
  'Full Body',
];

export const CANONICAL_WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * @typedef {{
 *   user_id: number | null;
 *   name: string | null;
 *   gender: string;
 *   age: number | null;
 *   height_cm: number | null;
 *   weight_kg: number | null;
 *   motivation: string | null;
 *   goal: string;
 *   fitness_level: string;
 *   main_profile_category: string;
 *   selected_sub_category: string | null;
 *   days_per_week: number;
 *   session_duration_minutes: number;
 *   preferred_training_time: string | null;
 *   body_type_or_null: string | null;
 *   photo_analysis_summary_or_null: string | null;
 *   split_preference: string;
 *   split_label: string | null;
 *   training_focus: string | null;
 *   recovery_priority: string | null;
 *   limitations: string | null;
 *   equipment_notes: string | null;
 *   available_equipment: string | null;
 *   language: string;
 *   images_provided_count: number;
 *   athlete_identity: string | null;
 *   athlete_identity_category: string | null;
 *   athlete_sub_category_id: string | null;
 *   athlete_sub_category_label: string | null;
 *   athlete_goal: string | null;
 *   taxonomy: {
 *     planning_track: 'female' | 'male' | 'neutral';
 *     branch_family: string;
 *     branch_focus: string | null;
 *     branch_rationale: string;
 *   };
 *   onboarding_snapshot: Record<string, unknown>;
 * }} ClaudePlanOnboardingPayload
 */

/**
 * @typedef {{
 *   name: string;
 *   targetMuscles: string[];
 *   sets: number;
 *   reps: string;
 *   restSeconds: number;
 *   notes: string;
 *   tempo?: string | null;
 *   rpeTarget?: number | null;
 * }} NormalizedPlanExercise
 */

/**
 * @typedef {{
 *   dayName: string;
 *   sessionName: string;
 *   focus: string;
 *   estimatedDurationMinutes: number;
 *   notes: string;
 *   exercises: NormalizedPlanExercise[];
 * }} NormalizedPlanWorkoutDay
 */

/**
 * @typedef {{
 *   phaseName: string;
 *   weekRange: { start: number; end: number };
 *   objective: string;
 *   workouts: NormalizedPlanWorkoutDay[];
 * }} NormalizedPlanPhase
 */
