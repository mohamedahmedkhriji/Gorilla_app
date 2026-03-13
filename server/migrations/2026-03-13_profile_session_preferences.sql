USE gorella_fitness;

-- Persist preferred gym session duration/time so edits survive profile updates.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_duration_minutes SMALLINT UNSIGNED NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_time VARCHAR(20) NULL;
