USE gorella_fitness;

-- Store full onboarding payload + normalized summary for AI traceability.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_profile JSON NULL;
