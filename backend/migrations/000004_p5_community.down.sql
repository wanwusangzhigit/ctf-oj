-- 000004_p5_community.down.sql
BEGIN;
DROP VIEW IF EXISTS team_score_view;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP INDEX IF EXISTS idx_users_banned;
ALTER TABLE users
  DROP COLUMN IF EXISTS banned_reason,
  DROP COLUMN IF EXISTS banned_at,
  DROP COLUMN IF EXISTS is_banned;
COMMIT;
