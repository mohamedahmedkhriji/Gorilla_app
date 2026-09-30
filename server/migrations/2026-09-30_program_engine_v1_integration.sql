USE gorella_fitness;

-- Add nullable metadata for deterministic Program Engine plans without altering legacy plans.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS engine_version VARCHAR(32) NULL;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS generation_key VARCHAR(64) NULL;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS generation_source VARCHAR(64) NULL;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS split_id VARCHAR(64) NULL;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS program_metadata_json JSON NULL;

-- Preserve week/day semantics and cardio prescriptions for generated workout-plan screens.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS program_engine_week SMALLINT UNSIGNED NULL;

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS program_engine_day TINYINT UNSIGNED NULL;

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS cardio_prescription_json JSON NULL;

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS slot_metadata_json JSON NULL;

-- Keep canonical Supabase exercise identity alongside the existing planned-exercise snapshots.
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS exercise_catalog_id BIGINT UNSIGNED NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS exercise_slug_snapshot VARCHAR(255) NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS slot_id VARCHAR(128) NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS slot_movement_pattern VARCHAR(80) NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS prescription_json JSON NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS progression_rule VARCHAR(128) NULL;

ALTER TABLE programs
  ADD INDEX IF NOT EXISTS idx_programs_generation_key (generation_key);

ALTER TABLE workouts
  ADD INDEX IF NOT EXISTS idx_workouts_program_engine_week (program_id, program_engine_week, program_engine_day);
