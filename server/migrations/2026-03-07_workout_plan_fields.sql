USE gorella_fitness;

-- Add workout-level duration field used by generated plans.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes SMALLINT UNSIGNED NULL;

-- Add exercise-level guidance fields used by generated plans.
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS target_weight DECIMAL(7,2) NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS tempo VARCHAR(20) NULL;

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS rpe_target DECIMAL(3,1) NULL;
