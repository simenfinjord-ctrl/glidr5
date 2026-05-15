-- Billing / subscription columns on teams
-- Run once against the production database

ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'free';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS current_period_end TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS trial_ends_at TEXT;

-- Onboarding tracking on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER NOT NULL DEFAULT 0;
