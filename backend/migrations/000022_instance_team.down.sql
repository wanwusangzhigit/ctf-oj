DROP INDEX IF EXISTS idx_instances_team;
ALTER TABLE instances DROP COLUMN IF EXISTS team_id;
