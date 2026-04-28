USE gorella_fitness;

-- Premium access flag. Existing users stay premium so current accounts keep access
-- while future premium-only features are introduced.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_premium TINYINT(1) NOT NULL DEFAULT 1;

UPDATE users
SET is_premium = 1
WHERE is_premium IS NULL;
