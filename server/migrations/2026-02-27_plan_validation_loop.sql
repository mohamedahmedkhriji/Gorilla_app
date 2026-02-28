USE gorella_fitness;

-- ============================================================
-- 1) AB EXPERIMENT THRESHOLDS FOR WEEKLY ADAPTATION
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_threshold_experiments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  experiment_key VARCHAR(64) NOT NULL,
  variant_key VARCHAR(32) NOT NULL,
  traffic_allocation_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  thresholds_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scoring_threshold_experiment (experiment_key, variant_key),
  INDEX idx_scoring_threshold_experiment_active (experiment_key, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_scoring_experiment_assignments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  experiment_key VARCHAR(64) NOT NULL,
  variant_key VARCHAR(32) NOT NULL,
  metadata_json JSON NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_scoring_assignment (user_id, experiment_key),
  INDEX idx_user_scoring_variant (experiment_key, variant_key),
  CONSTRAINT fk_user_scoring_assignment_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 2) WEEKLY RECOMMENDATION OUTCOMES (VALIDATION LOOP)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_recommendation_outcomes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  program_id BIGINT NULL,
  assignment_id BIGINT NULL,
  adaptation_id BIGINT NULL,
  experiment_key VARCHAR(64) NULL,
  variant_key VARCHAR(32) NULL,
  source ENUM('auto_weekly', 'manual', 'backfill') NOT NULL DEFAULT 'auto_weekly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  planned_sessions INT UNSIGNED NOT NULL DEFAULT 0,
  completed_sessions INT UNSIGNED NOT NULL DEFAULT 0,
  adherence_pct DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  avg_recovery_score DECIMAL(5,2) NULL,
  avg_risk_score DECIMAL(5,2) NULL,
  avg_readiness_score DECIMAL(5,2) NULL,
  confidence_avg DECIMAL(5,2) NULL,
  performance_delta_pct DECIMAL(7,2) NULL,
  body_weight_delta_kg DECIMAL(7,2) NULL,
  outcome_band ENUM('poor', 'stable', 'positive', 'excellent') NOT NULL DEFAULT 'stable',
  metrics_json JSON NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_outcome_window (user_id, period_start, period_end, source),
  INDEX idx_plan_outcome_user_period (user_id, period_end),
  INDEX idx_plan_outcome_variant_period (variant_key, period_end),
  INDEX idx_plan_outcome_adaptation (adaptation_id),
  CONSTRAINT fk_plan_outcome_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_outcome_adaptation
    FOREIGN KEY (adaptation_id) REFERENCES plan_adaptations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 3) DEFAULT EXPERIMENT SEED
-- ============================================================
INSERT INTO scoring_threshold_experiments
  (experiment_key, variant_key, traffic_allocation_pct, thresholds_json, is_active)
VALUES
  (
    'weekly_adaptation_thresholds_v1',
    'control',
    50.00,
    JSON_OBJECT(
      'criticalRiskMin', 80,
      'criticalReadinessMax', 35,
      'highRiskMin', 65,
      'highReadinessMax', 50,
      'highRecoveryMax', 55,
      'progressionReadinessMin', 78,
      'progressionRecoveryMin', 75,
      'progressionRiskMax', 40,
      'progressionConfidenceMin', 60,
      'progressionGuardConfidenceMin', 45
    ),
    1
  ),
  (
    'weekly_adaptation_thresholds_v1',
    'conservative_guard',
    25.00,
    JSON_OBJECT(
      'criticalRiskMin', 78,
      'criticalReadinessMax', 38,
      'highRiskMin', 60,
      'highReadinessMax', 55,
      'highRecoveryMax', 58,
      'progressionReadinessMin', 82,
      'progressionRecoveryMin', 78,
      'progressionRiskMax', 35,
      'progressionConfidenceMin', 65,
      'progressionGuardConfidenceMin', 50
    ),
    1
  ),
  (
    'weekly_adaptation_thresholds_v1',
    'progressive_load',
    25.00,
    JSON_OBJECT(
      'criticalRiskMin', 85,
      'criticalReadinessMax', 30,
      'highRiskMin', 70,
      'highReadinessMax', 45,
      'highRecoveryMax', 50,
      'progressionReadinessMin', 74,
      'progressionRecoveryMin', 70,
      'progressionRiskMax', 45,
      'progressionConfidenceMin', 55,
      'progressionGuardConfidenceMin', 40
    ),
    1
  )
ON DUPLICATE KEY UPDATE
  traffic_allocation_pct = VALUES(traffic_allocation_pct),
  thresholds_json = VALUES(thresholds_json),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
