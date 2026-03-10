USE gorella_fitness;

-- XP- and reward-based gamification foundation.
-- This migration is additive and preserves the existing live mission/rank flow.
-- Existing missions/user_missions tables are extended instead of replaced.

CREATE TABLE IF NOT EXISTS levels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  level_number INT NOT NULL UNIQUE,
  level_name VARCHAR(80) NOT NULL,
  xp_required INT NOT NULL,
  tier INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_workouts INT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS `rank` VARCHAR(50) NOT NULL DEFAULT 'Bronze';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_level_id INT NULL;

ALTER TABLE users
  MODIFY COLUMN `rank` VARCHAR(50) NOT NULL DEFAULT 'Bronze';

ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_current_level_id (current_level_id);

UPDATE users
SET total_points = COALESCE(total_points, 0),
    total_workouts = COALESCE(total_workouts, 0),
    total_xp = CASE
      WHEN COALESCE(total_xp, 0) > 0 THEN total_xp
      ELSE COALESCE(total_points, 0)
    END,
    `rank` = CASE
      WHEN NULLIF(TRIM(COALESCE(`rank`, '')), '') IS NULL THEN 'Bronze'
      WHEN LOWER(TRIM(`rank`)) = 'beginner' THEN 'Bronze'
      ELSE `rank`
    END;

CREATE TABLE IF NOT EXISTS xp_transactions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  source_type ENUM(
    'workout',
    'planned_workout',
    'pr',
    'challenge_complete',
    'challenge_win',
    'mission_complete',
    'nutrition',
    'hydration',
    'sleep',
    'progress_photo',
    'share',
    'referral',
    'program_week',
    'program_complete',
    'badge_unlock',
    'achievement_unlock',
    'level_up',
    'manual_adjustment'
  ) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  xp_amount INT NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_xp_transactions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_xp_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_xp (
  user_id INT UNSIGNED PRIMARY KEY,
  total_xp INT NOT NULL DEFAULT 0,
  current_level_id INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_xp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_xp_level
    FOREIGN KEY (current_level_id) REFERENCES levels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badge_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

INSERT INTO badge_categories (name, description)
SELECT 'consistency', 'Rewards repetition, streaks, and long-term discipline.'
WHERE NOT EXISTS (SELECT 1 FROM badge_categories WHERE name = 'consistency');

INSERT INTO badge_categories (name, description)
SELECT 'effort', 'Rewards training volume, milestones, and hard work.'
WHERE NOT EXISTS (SELECT 1 FROM badge_categories WHERE name = 'effort');

INSERT INTO badge_categories (name, description)
SELECT 'challenge', 'Rewards wins and mission or challenge performance.'
WHERE NOT EXISTS (SELECT 1 FROM badge_categories WHERE name = 'challenge');

INSERT INTO badge_categories (name, description)
SELECT 'recovery', 'Rewards recovery, sleep, and readiness consistency.'
WHERE NOT EXISTS (SELECT 1 FROM badge_categories WHERE name = 'recovery');

CREATE TABLE IF NOT EXISTS badges (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  icon_url VARCHAR(255) NULL,
  rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common',
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  xp_reward INT NOT NULL DEFAULT 0,
  points_reward INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_badges_category
    FOREIGN KEY (category_id) REFERENCES badge_categories(id) ON DELETE RESTRICT,
  INDEX idx_badges_category (category_id),
  INDEX idx_badges_hidden (is_hidden)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badge_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  badge_id BIGINT UNSIGNED NOT NULL,
  condition_type VARCHAR(80) NOT NULL,
  operator_symbol ENUM('>=', '=', '<=', '>', '<') NOT NULL DEFAULT '>=',
  target_value DECIMAL(12,2) NOT NULL,
  secondary_value DECIMAL(12,2) NULL,
  timeframe_type ENUM('lifetime', 'daily', 'weekly', 'monthly', 'program', 'custom') NOT NULL DEFAULT 'lifetime',
  timeframe_days INT NULL,
  stack_group VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_badge_rules_badge
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  INDEX idx_badge_rules_badge (badge_id),
  INDEX idx_badge_rules_type (condition_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  badge_id BIGINT UNSIGNED NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  progress_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_seen BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_user_badge (user_id, badge_id),
  CONSTRAINT fk_user_badges_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_badges_badge
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  INDEX idx_user_badges_user (user_id),
  INDEX idx_user_badges_unlocked (unlocked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badge_progress (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  badge_id BIGINT UNSIGNED NOT NULL,
  current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_value DECIMAL(12,2) NOT NULL,
  percent_complete DECIMAL(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_badge_progress (user_id, badge_id),
  CONSTRAINT fk_user_badge_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_badge_progress_badge
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  INDEX idx_user_badge_progress_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achievements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  xp_reward INT NOT NULL DEFAULT 0,
  reward_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_achievements_reward (reward_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achievement_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  achievement_id BIGINT UNSIGNED NOT NULL,
  condition_type VARCHAR(80) NOT NULL,
  operator_symbol ENUM('>=', '=', '<=', '>', '<') NOT NULL DEFAULT '>=',
  target_value DECIMAL(12,2) NOT NULL,
  timeframe_type ENUM('lifetime', 'daily', 'weekly', 'monthly', 'program', 'custom') NOT NULL DEFAULT 'lifetime',
  timeframe_days INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_achievement_rules_achievement
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  INDEX idx_achievement_rules_achievement (achievement_id),
  INDEX idx_achievement_rules_type (condition_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_achievements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  achievement_id BIGINT UNSIGNED NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_achievement (user_id, achievement_id),
  CONSTRAINT fk_user_achievements_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_achievements_achievement
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  INDEX idx_user_achievements_user (user_id),
  INDEX idx_user_achievements_unlocked (unlocked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rewards (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reward_type ENUM(
    'xp_boost',
    'profile_frame',
    'title',
    'avatar_item',
    'challenge_ticket',
    'discount',
    'premium_days',
    'coach_message',
    'feature_unlock',
    'cosmetic'
  ) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  value_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS level_rewards (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  level_id INT NOT NULL,
  reward_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_level_rewards_level
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
  CONSTRAINT fk_level_rewards_reward
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  UNIQUE KEY uq_level_reward (level_id, reward_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_rewards (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  reward_id BIGINT UNSIGNED NOT NULL,
  source_type ENUM('level', 'badge', 'achievement', 'mission', 'manual') NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TIMESTAMP NULL,
  status ENUM('available', 'consumed', 'expired') NOT NULL DEFAULT 'available',
  CONSTRAINT fk_user_rewards_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_rewards_reward
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  INDEX idx_user_rewards_user (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS titles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_titles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title_id BIGINT UNSIGNED NOT NULL,
  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_title (user_id, title_id),
  CONSTRAINT fk_user_titles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_titles_title
    FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE,
  INDEX idx_user_titles_user (user_id),
  INDEX idx_user_titles_equipped (user_id, is_equipped)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS missions (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  name VARCHAR(120) NULL,
  description TEXT NULL,
  mission_type ENUM('daily', 'weekly', 'monthly', 'achievement', 'special') NOT NULL,
  category VARCHAR(50) NULL,
  metric_key VARCHAR(100) NULL,
  target_value INT UNSIGNED NOT NULL DEFAULT 1,
  points_reward INT NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 0,
  reward_id BIGINT UNSIGNED NULL,
  badge_icon VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_missions_active (is_active),
  INDEX idx_missions_type (mission_type),
  INDEX idx_missions_reward (reward_id)
) ENGINE=InnoDB;

ALTER TABLE missions
  MODIFY COLUMN mission_type ENUM('daily', 'weekly', 'monthly', 'achievement', 'special') NOT NULL;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS name VARCHAR(120) NULL AFTER title;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS xp_reward INT NOT NULL DEFAULT 0 AFTER points_reward;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS reward_id BIGINT UNSIGNED NULL AFTER xp_reward;

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE AFTER reward_id;

ALTER TABLE missions
  ADD INDEX IF NOT EXISTS idx_missions_reward (reward_id);

UPDATE missions
SET name = COALESCE(NULLIF(name, ''), title);

UPDATE missions
SET active = CASE
  WHEN is_active IS NULL THEN TRUE
  WHEN is_active = 0 THEN FALSE
  ELSE TRUE
END;

CREATE TABLE IF NOT EXISTS mission_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  mission_id INT UNSIGNED NOT NULL,
  condition_type VARCHAR(80) NOT NULL,
  operator_symbol ENUM('>=', '=', '<=', '>', '<') NOT NULL DEFAULT '>=',
  target_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mission_rules_mission
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  INDEX idx_mission_rules_mission (mission_id),
  INDEX idx_mission_rules_type (condition_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_missions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  mission_id INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  instance_key VARCHAR(30) NOT NULL DEFAULT 'default',
  current_progress INT UNSIGNED NOT NULL DEFAULT 0,
  progress_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  baseline_value INT UNSIGNED NOT NULL DEFAULT 0,
  target_value INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active',
  completed_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_missions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_missions_mission
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_missions_unique_instance (user_id, mission_id, instance_key),
  INDEX idx_user_missions_user_status (user_id, status),
  INDEX idx_user_missions_assigned (user_id, assigned_at)
) ENGINE=InnoDB;

ALTER TABLE user_missions
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER mission_id;

ALTER TABLE user_missions
  ADD COLUMN IF NOT EXISTS progress_value DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER current_progress;

UPDATE user_missions
SET assigned_at = COALESCE(assigned_at, created_at);

UPDATE user_missions
SET progress_value = CAST(current_progress AS DECIMAL(12,2))
WHERE progress_value = 0 AND current_progress IS NOT NULL;

ALTER TABLE user_missions
  ADD INDEX IF NOT EXISTS idx_user_missions_assigned (user_id, assigned_at);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (1, 'Beginner', 0, 1)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (2, 'Rookie', 100, 2)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (3, 'Trainee', 250, 3)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (4, 'Active', 500, 4)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (5, 'Dedicated', 900, 5)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (6, 'Challenger', 1500, 6)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (7, 'Performer', 2300, 7)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (8, 'Athlete', 3500, 8)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (9, 'Advanced', 5000, 9)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (10, 'Pro', 7000, 10)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (11, 'Elite', 9500, 11)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (12, 'Master', 12500, 12)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (13, 'Champion', 16000, 13)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (14, 'Titan', 21000, 14)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO levels (level_number, level_name, xp_required, tier)
VALUES (15, 'Legend', 28000, 15)
ON DUPLICATE KEY UPDATE level_name = VALUES(level_name), xp_required = VALUES(xp_required), tier = VALUES(tier);

INSERT INTO user_xp (user_id, total_xp, current_level_id)
SELECT u.id, GREATEST(COALESCE(u.total_xp, 0), COALESCE(u.total_points, 0)), (
  SELECT l.id
  FROM levels l
  WHERE l.xp_required <= GREATEST(COALESCE(u.total_xp, 0), COALESCE(u.total_points, 0))
  ORDER BY l.xp_required DESC, l.id DESC
  LIMIT 1
)
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM user_xp ux
  WHERE ux.user_id = u.id
);

UPDATE users u
JOIN user_xp ux ON ux.user_id = u.id
SET u.current_level_id = ux.current_level_id
WHERE u.current_level_id IS NULL;
