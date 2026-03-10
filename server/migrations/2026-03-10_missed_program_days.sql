USE gorella_fitness;

CREATE TABLE IF NOT EXISTS missed_program_days (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  program_assignment_id INT UNSIGNED NULL,
  workout_id INT UNSIGNED NULL,
  missed_date DATE NOT NULL,
  workout_name VARCHAR(255) NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_missed_program_days_user_date (user_id, missed_date),
  KEY idx_missed_program_days_assignment_date (program_assignment_id, missed_date),
  CONSTRAINT fk_missed_program_days_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
