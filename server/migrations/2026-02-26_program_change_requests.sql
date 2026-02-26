USE gorella_fitness;

CREATE TABLE IF NOT EXISTS program_change_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  coach_id BIGINT NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  cycle_weeks TINYINT NOT NULL,
  selected_days_json JSON NOT NULL,
  weekly_workouts_json JSON NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  review_notes VARCHAR(500) NULL,
  approved_program_id BIGINT NULL,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_program_change_requests_coach_status (coach_id, status, created_at),
  INDEX idx_program_change_requests_user_status (user_id, status, created_at),
  INDEX idx_program_change_requests_status_created (status, created_at)
) ENGINE=InnoDB;
