USE gorella_fitness;

-- Track when a banned user should be soft-deactivated.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_delete_at DATETIME NULL;
