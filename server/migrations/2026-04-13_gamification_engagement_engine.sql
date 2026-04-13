-- RepSet gamification engagement engine hardening
-- Safe incremental additions for mission chains, reward identity, and streak persistence.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS chain_id VARCHAR(80) NULL AFTER metric_key;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS chain_step INT NULL AFTER chain_id;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS chain_length INT NULL AFTER chain_step;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS chain_bonus_xp INT NOT NULL DEFAULT 0 AFTER chain_length;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS chain_bonus_points INT NOT NULL DEFAULT 0 AFTER chain_bonus_xp;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS unlock_level INT NULL AFTER chain_bonus_points;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS unlock_rank VARCHAR(50) NULL AFTER unlock_level;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common' AFTER value_json;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS identity_key VARCHAR(120) NULL AFTER rarity;

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS visual_variant VARCHAR(120) NULL AFTER identity_key;

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id INT UNSIGNED PRIMARY KEY,
  daily_activity_streak INT NOT NULL DEFAULT 0,
  workout_streak INT NOT NULL DEFAULT 0,
  recovery_streak INT NOT NULL DEFAULT 0,
  weekly_consistency_streak INT NOT NULL DEFAULT 0,
  freeze_tokens INT NOT NULL DEFAULT 0,
  last_activity_date DATE NULL,
  protected_today TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_streaks_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
