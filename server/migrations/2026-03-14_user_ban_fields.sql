USE gorella_fitness;

-- Support user bans and visibility filtering.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_until DATETIME NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ban_created_at DATETIME NULL;
