DROP TABLE IF EXISTS competition_access_grants;

ALTER TABLE challenge_access_grants
    DROP CONSTRAINT IF EXISTS challenge_access_grants_permission_check;

ALTER TABLE challenge_access_grants
    DROP COLUMN IF EXISTS permission;
