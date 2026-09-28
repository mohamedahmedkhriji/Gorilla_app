CREATE TABLE IF NOT EXISTS nutrition_health_profiles (
  user_id INT PRIMARY KEY,
  conditions_json JSON NULL,
  allergies_json JSON NULL,
  intolerances_json JSON NULL,
  clinician_nutrition_plan TINYINT(1) NULL,
  prefer_not_to_say TINYINT(1) NOT NULL DEFAULT 0,
  no_known_condition TINYINT(1) NOT NULL DEFAULT 0,
  onboarding_version INT NOT NULL DEFAULT 1,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nutrition_health_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nutrition_hydration_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount_ml INT UNSIGNED NOT NULL,
  drink_type VARCHAR(40) NOT NULL DEFAULT 'water',
  logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nutrition_hydration_user_logged_at (user_id, logged_at),
  CONSTRAINT fk_nutrition_hydration_entries_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
