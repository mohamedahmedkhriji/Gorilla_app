SET @has_legacy_achievements_user_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'achievements'
    AND column_name = 'user_id'
);
SET @sql_achievements_user_id := IF(
  @has_legacy_achievements_user_id > 0,
  'ALTER TABLE achievements MODIFY COLUMN user_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt_achievements_user_id FROM @sql_achievements_user_id;
EXECUTE stmt_achievements_user_id;
DEALLOCATE PREPARE stmt_achievements_user_id;

SET @has_legacy_achievements_key := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'achievements'
    AND column_name = 'achievement_key'
);
SET @sql_achievements_key := IF(
  @has_legacy_achievements_key > 0,
  'ALTER TABLE achievements MODIFY COLUMN achievement_key VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt_achievements_key FROM @sql_achievements_key;
EXECUTE stmt_achievements_key;
DEALLOCATE PREPARE stmt_achievements_key;

SET @has_legacy_achievements_title := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'achievements'
    AND column_name = 'title'
);
SET @sql_achievements_title := IF(
  @has_legacy_achievements_title > 0,
  'ALTER TABLE achievements MODIFY COLUMN title VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt_achievements_title FROM @sql_achievements_title;
EXECUTE stmt_achievements_title;
DEALLOCATE PREPARE stmt_achievements_title;

SET @has_achievements_slug_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'achievements'
    AND index_name = 'uq_achievements_slug'
);
SET @sql_achievements_slug_index := IF(
  @has_achievements_slug_index = 0,
  'CREATE UNIQUE INDEX uq_achievements_slug ON achievements (slug)',
  'SELECT 1'
);
PREPARE stmt_achievements_slug_index FROM @sql_achievements_slug_index;
EXECUTE stmt_achievements_slug_index;
DEALLOCATE PREPARE stmt_achievements_slug_index;
