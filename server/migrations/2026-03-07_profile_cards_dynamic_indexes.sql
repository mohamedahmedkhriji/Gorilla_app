USE gorella_fitness;

-- Speeds up rank/classification queries scoped by role/gym/points.
SET @idx_users_scope_points_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_scope_points'
);
SET @sql_users_scope_points := IF(
  @idx_users_scope_points_exists = 0,
  'CREATE INDEX idx_users_scope_points ON users (role, is_active, gym_id, total_points, id)',
  'SELECT 1'
);
PREPARE stmt_users_scope_points FROM @sql_users_scope_points;
EXECUTE stmt_users_scope_points;
DEALLOCATE PREPARE stmt_users_scope_points;

-- Speeds up active-program lookup for profile cards.
SET @idx_program_assign_user_status_created_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'program_assignments'
    AND index_name = 'idx_program_assign_user_status_created'
);
SET @sql_program_assign_user_status_created := IF(
  @idx_program_assign_user_status_created_exists = 0,
  'CREATE INDEX idx_program_assign_user_status_created ON program_assignments (user_id, status, created_at)',
  'SELECT 1'
);
PREPARE stmt_program_assign_user_status_created FROM @sql_program_assign_user_status_created;
EXECUTE stmt_program_assign_user_status_created;
DEALLOCATE PREPARE stmt_program_assign_user_status_created;

-- Speeds up completed-session counting per assignment.
SET @idx_workout_sessions_user_assignment_status_completed_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'workout_sessions'
    AND index_name = 'idx_workout_sessions_user_assignment_status_completed'
);
SET @sql_workout_sessions_user_assignment_status_completed := IF(
  @idx_workout_sessions_user_assignment_status_completed_exists = 0,
  'CREATE INDEX idx_workout_sessions_user_assignment_status_completed ON workout_sessions (user_id, program_assignment_id, status, completed_at)',
  'SELECT 1'
);
PREPARE stmt_workout_sessions_user_assignment_status_completed FROM @sql_workout_sessions_user_assignment_status_completed;
EXECUTE stmt_workout_sessions_user_assignment_status_completed;
DEALLOCATE PREPARE stmt_workout_sessions_user_assignment_status_completed;

-- Speeds up completed-workout day counting from logged sets.
SET @idx_workout_sets_user_completed_created_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'workout_sets'
    AND index_name = 'idx_workout_sets_user_completed_created'
);
SET @sql_workout_sets_user_completed_created := IF(
  @idx_workout_sets_user_completed_created_exists = 0,
  'CREATE INDEX idx_workout_sets_user_completed_created ON workout_sets (user_id, completed, created_at)',
  'SELECT 1'
);
PREPARE stmt_workout_sets_user_completed_created FROM @sql_workout_sets_user_completed_created;
EXECUTE stmt_workout_sets_user_completed_created;
DEALLOCATE PREPARE stmt_workout_sets_user_completed_created;
