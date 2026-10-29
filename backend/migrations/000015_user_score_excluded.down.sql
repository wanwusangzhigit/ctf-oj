DROP INDEX IF EXISTS idx_users_score_excluded;
ALTER TABLE users DROP COLUMN IF EXISTS score_excluded;
