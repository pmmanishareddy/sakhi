-- One-way UI flags (journey dismissed, first suggestion seen) that must
-- survive app reinstalls — localStorage is wiped with the home-screen icon.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_flags JSONB NOT NULL DEFAULT '{}';
