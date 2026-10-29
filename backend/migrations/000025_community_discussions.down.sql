DROP TABLE IF EXISTS community_access_grants;

DROP INDEX IF EXISTS idx_discussions_team;
DROP INDEX IF EXISTS idx_discussions_community;

DELETE FROM discussions WHERE scope <> 'challenge';

ALTER TABLE discussions
    DROP CONSTRAINT IF EXISTS discussions_target_check,
    DROP CONSTRAINT IF EXISTS discussions_scope_check,
    DROP COLUMN IF EXISTS title,
    DROP COLUMN IF EXISTS team_id,
    DROP COLUMN IF EXISTS scope;

ALTER TABLE discussions ALTER COLUMN challenge_id SET NOT NULL;
