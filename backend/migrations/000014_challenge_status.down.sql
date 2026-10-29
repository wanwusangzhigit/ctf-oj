DROP INDEX IF EXISTS idx_challenges_status;
ALTER TABLE challenges DROP COLUMN IF EXISTS status;
