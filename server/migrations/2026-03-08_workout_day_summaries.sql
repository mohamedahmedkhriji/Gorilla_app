USE gorella_fitness;

CREATE TABLE IF NOT EXISTS workout_day_summaries (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  summary_date DATE NOT NULL,
  workout_name VARCHAR(255) NOT NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  estimated_calories INT UNSIGNED NOT NULL DEFAULT 0,
  total_volume DECIMAL(12,2) NOT NULL DEFAULT 0,
  records_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  muscles_json JSON NOT NULL,
  exercises_json JSON NOT NULL,
  summary_text TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workout_day_summaries_user_date (user_id, summary_date),
  CONSTRAINT fk_workout_day_summaries_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @idx_workout_day_summaries_user_updated_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'workout_day_summaries'
    AND index_name = 'idx_workout_day_summaries_user_updated'
);
SET @sql_workout_day_summaries_user_updated := IF(
  @idx_workout_day_summaries_user_updated_exists = 0,
  'CREATE INDEX idx_workout_day_summaries_user_updated ON workout_day_summaries (user_id, updated_at)',
  'SELECT 1'
);
PREPARE stmt_workout_day_summaries_user_updated FROM @sql_workout_day_summaries_user_updated;
EXECUTE stmt_workout_day_summaries_user_updated;
DEALLOCATE PREPARE stmt_workout_day_summaries_user_updated;
