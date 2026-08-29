USE gorella_fitness;

-- Store body measurements captured during onboarding and profile editing.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,2) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,2) NULL;

-- Store the user's plain-language primary goal for onboarding/profile screens.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(64) NULL;
