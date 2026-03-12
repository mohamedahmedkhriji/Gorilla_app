USE gorella_fitness;

-- Persist athlete onboarding branch + sport context as first-class user fields.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_identity VARCHAR(40) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_identity_label VARCHAR(80) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_identity_category VARCHAR(40) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_sub_category_id VARCHAR(100) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_sub_category_label VARCHAR(120) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_sub_category_group_id VARCHAR(100) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_sub_category_group_label VARCHAR(120) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS athlete_goal VARCHAR(120) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sport_practice_years DECIMAL(5,2) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS experience_level_source VARCHAR(40) NULL;

-- Persist plan-choice/AI onboarding controls for quick querying.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS workout_split_preference VARCHAR(40) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS workout_split_label VARCHAR(80) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_reason VARCHAR(160) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_training_focus VARCHAR(40) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_limitations VARCHAR(300) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_recovery_priority VARCHAR(40) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_equipment_notes VARCHAR(240) NULL;
