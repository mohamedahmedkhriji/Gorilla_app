USE gorella_fitness;

-- ============================================================
-- 1) PROGRAM CATALOG (for program-level datasets)
-- ============================================================
CREATE TABLE IF NOT EXISTS program_catalog (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_dataset VARCHAR(32) NOT NULL DEFAULT 'manual',
  source_row_key VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  level VARCHAR(32) NULL,
  goal VARCHAR(64) NULL,
  equipment VARCHAR(64) NULL,
  program_length_weeks INT NULL,
  time_per_workout_min INT NULL,
  total_exercises INT NULL,
  source_created_at DATETIME NULL,
  source_last_edit_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_program_catalog_source (source_dataset, source_row_key),
  INDEX idx_program_catalog_title (title),
  INDEX idx_program_catalog_filters (goal, level, equipment, program_length_weeks)
) ENGINE=InnoDB;

-- ============================================================
-- 2) EXERCISE CATALOG (unified exercise metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_catalog (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_dataset VARCHAR(32) NOT NULL DEFAULT 'manual',
  source_row_key VARCHAR(128) NULL,
  canonical_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NULL,
  description TEXT NULL,
  exercise_type VARCHAR(64) NULL,
  body_part VARCHAR(64) NULL,
  equipment VARCHAR(64) NULL,
  level VARCHAR(32) NULL,
  rating DECIMAL(4,2) NULL,
  rating_desc TEXT NULL,
  mechanics VARCHAR(64) NULL,
  force_type VARCHAR(32) NULL,
  utility VARCHAR(64) NULL,
  difficulty_tier TINYINT NULL,
  instructions_preparation TEXT NULL,
  instructions_execution TEXT NULL,
  is_stretch TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_catalog_source (source_dataset, source_row_key),
  INDEX idx_exercise_catalog_name (canonical_name),
  INDEX idx_exercise_catalog_normalized (normalized_name),
  INDEX idx_exercise_catalog_filters (body_part, equipment, level, exercise_type)
) ENGINE=InnoDB;

-- ============================================================
-- 3) EXERCISE-TO-MUSCLE MAP (target/synergist/stabilizer...)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_catalog_muscles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exercise_catalog_id BIGINT NOT NULL,
  muscle_group VARCHAR(64) NOT NULL,
  role ENUM('target', 'synergist', 'stabilizer', 'antagonist', 'dynamic_stabilizer', 'secondary') NOT NULL,
  load_factor DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_muscle_role (exercise_catalog_id, muscle_group, role),
  INDEX idx_exercise_catalog_muscles_muscle (muscle_group),
  CONSTRAINT fk_exercise_catalog_muscles_exercise
    FOREIGN KEY (exercise_catalog_id) REFERENCES exercise_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 4) EXERCISE ALIASES (name matching from logs/imports)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_aliases (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exercise_catalog_id BIGINT NOT NULL,
  alias_name VARCHAR(255) NOT NULL,
  alias_normalized VARCHAR(255) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_alias_norm (alias_normalized),
  INDEX idx_exercise_alias_exercise (exercise_catalog_id),
  CONSTRAINT fk_exercise_aliases_exercise
    FOREIGN KEY (exercise_catalog_id) REFERENCES exercise_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 5) RECOVERY COEFFICIENTS + EXERCISE RECOVERY PROFILE
-- ============================================================
CREATE TABLE IF NOT EXISTS recovery_coefficients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  muscle_group VARCHAR(64) NOT NULL,
  intensity_band ENUM('low', 'moderate', 'high') NOT NULL,
  base_hours DECIMAL(6,2) NOT NULL,
  volume_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  eccentric_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recovery_coeff (muscle_group, intensity_band)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exercise_recovery_profile (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exercise_catalog_id BIGINT NOT NULL,
  systemic_stress_score DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  cns_load_score DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  eccentric_bias_score DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_recovery_profile (exercise_catalog_id),
  CONSTRAINT fk_exercise_recovery_profile_exercise
    FOREIGN KEY (exercise_catalog_id) REFERENCES exercise_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 6) LINK WORKOUT LOGS TO EXERCISE CATALOG
-- ============================================================
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS exercise_catalog_id BIGINT NULL AFTER exercise_name;

ALTER TABLE workout_sets
  ADD INDEX IF NOT EXISTS idx_workout_sets_catalog_created (exercise_catalog_id, created_at);

ALTER TABLE workout_sets
  ADD INDEX IF NOT EXISTS idx_workout_sets_user_created (user_id, created_at);

-- Add FK only once (safe for reruns).
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'workout_sets'
    AND constraint_name = 'fk_workout_sets_exercise_catalog'
    AND constraint_type = 'FOREIGN KEY'
);
SET @sql_fk := IF(
  @fk_exists = 0,
  'ALTER TABLE workout_sets ADD CONSTRAINT fk_workout_sets_exercise_catalog FOREIGN KEY (exercise_catalog_id) REFERENCES exercise_catalog(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- ============================================================
-- 7) INITIAL BACKFILL BY ALIAS NAME MATCHING
-- ============================================================
UPDATE workout_sets ws
JOIN exercise_aliases ea
  ON LOWER(TRIM(ws.exercise_name)) = ea.alias_normalized
SET ws.exercise_catalog_id = ea.exercise_catalog_id
WHERE ws.exercise_catalog_id IS NULL;

