USE gorella_fitness;

-- ============================================================
-- 1) USER HEALTH SNAPSHOTS
-- Daily/weekly check-in metrics used for trend analysis.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_health_snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  snapshot_date DATE NOT NULL,
  source ENUM('onboarding', 'weekly_checkin', 'manual', 'device_sync') NOT NULL DEFAULT 'weekly_checkin',

  hours_sleep DECIMAL(4,2) NULL,
  stress_level TINYINT NULL,
  hydration_liters DECIMAL(4,2) NULL,
  daily_steps INT NULL,
  resting_heart_rate DECIMAL(5,2) NULL,
  blood_pressure_systolic DECIMAL(5,2) NULL,
  blood_pressure_diastolic DECIMAL(5,2) NULL,
  weight_kg DECIMAL(6,2) NULL,
  bmi DECIMAL(5,2) NULL,

  notes VARCHAR(500) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_user_health_snapshots_user_date (user_id, snapshot_date),
  INDEX idx_user_health_snapshots_user_created (user_id, created_at),
  INDEX idx_user_health_snapshots_snapshot_date (snapshot_date),

  CONSTRAINT fk_user_health_snapshots_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 2) USER INSIGHT SCORES
-- Stores computed scoring outputs (onboarding/recovery/risk/confidence...).
-- ============================================================
CREATE TABLE IF NOT EXISTS user_insight_scores (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  snapshot_id BIGINT NULL,
  insight_date DATE NOT NULL,
  score_type ENUM('onboarding', 'recovery', 'risk', 'readiness', 'confidence', 'adherence', 'performance') NOT NULL,
  score_value DECIMAL(5,2) NOT NULL,
  score_band ENUM('low', 'medium', 'high', 'unknown') NOT NULL DEFAULT 'unknown',
  model_version VARCHAR(32) NOT NULL DEFAULT 'v1',
  synthetic_only TINYINT(1) NOT NULL DEFAULT 1,
  explanation JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_user_insight_scores_user_date_type (user_id, insight_date, score_type),
  INDEX idx_user_insight_scores_user_type_created (user_id, score_type, created_at),
  INDEX idx_user_insight_scores_snapshot (snapshot_id),

  CONSTRAINT fk_user_insight_scores_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_insight_scores_snapshot
    FOREIGN KEY (snapshot_id) REFERENCES user_health_snapshots(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 3) PLAN ADAPTATIONS
-- Audit log of automatic/manual changes made to a user plan.
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_adaptations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  program_id BIGINT NULL,
  adaptation_date DATE NOT NULL,
  trigger_source ENUM('onboarding', 'weekly_analysis', 'auto_deload', 'progression', 'coach_override', 'manual') NOT NULL DEFAULT 'weekly_analysis',
  confidence_score DECIMAL(5,2) NULL,
  previous_plan_json JSON NULL,
  adapted_plan_json JSON NOT NULL,
  change_summary_json JSON NULL,
  reason_codes_json JSON NULL,
  reviewed_by_coach TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plan_adaptations_user_created (user_id, created_at),
  INDEX idx_plan_adaptations_adaptation_date (adaptation_date),
  INDEX idx_plan_adaptations_program (program_id),

  CONSTRAINT fk_plan_adaptations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
