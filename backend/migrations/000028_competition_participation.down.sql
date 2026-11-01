DROP INDEX IF EXISTS idx_discussions_competition;

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_target_check;
ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_scope_check;

DELETE FROM discussions WHERE scope = 'competition';
ALTER TABLE discussions DROP COLUMN IF EXISTS competition_id;

ALTER TABLE discussions
    ADD CONSTRAINT discussions_scope_check
    CHECK (scope IN ('challenge', 'community', 'team'));
ALTER TABLE discussions
    ADD CONSTRAINT discussions_target_check
    CHECK (
        (scope = 'challenge' AND challenge_id IS NOT NULL AND team_id IS NULL) OR
        (scope = 'community' AND challenge_id IS NULL AND team_id IS NULL) OR
        (scope = 'team' AND challenge_id IS NULL AND team_id IS NOT NULL)
    );

DROP TABLE IF EXISTS competition_announcements;
DROP TABLE IF EXISTS competition_registrations;

ALTER TABLE competitions DROP COLUMN IF EXISTS registration_required;
