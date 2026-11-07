DROP INDEX IF EXISTS idx_discussions_community_section;

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_target_check;
ALTER TABLE discussions DROP COLUMN IF EXISTS section_id;

ALTER TABLE discussions
    ADD CONSTRAINT discussions_target_check
    CHECK (
        (scope = 'challenge' AND challenge_id IS NOT NULL AND team_id IS NULL AND competition_id IS NULL) OR
        (scope = 'community' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NULL) OR
        (scope = 'team' AND challenge_id IS NULL AND team_id IS NOT NULL AND competition_id IS NULL) OR
        (scope = 'competition' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NOT NULL)
    );

-- Community topics lose their board and return to the single-board shape; the
-- topics themselves are not discussion data created by this migration.
DROP TABLE IF EXISTS community_section_grants;
DROP TABLE IF EXISTS community_sections;
