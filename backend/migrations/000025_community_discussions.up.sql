-- 000025: community/team discussion scopes and community access grants.

ALTER TABLE discussions ALTER COLUMN challenge_id DROP NOT NULL;

ALTER TABLE discussions
    ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'challenge',
    ADD COLUMN IF NOT EXISTS team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS title VARCHAR(160) NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'discussions_scope_check'
    ) THEN
        ALTER TABLE discussions
            ADD CONSTRAINT discussions_scope_check
            CHECK (scope IN ('challenge', 'community', 'team'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'discussions_target_check'
    ) THEN
        ALTER TABLE discussions
            ADD CONSTRAINT discussions_target_check
            CHECK (
                (scope = 'challenge' AND challenge_id IS NOT NULL AND team_id IS NULL) OR
                (scope = 'community' AND challenge_id IS NULL AND team_id IS NULL) OR
                (scope = 'team' AND challenge_id IS NULL AND team_id IS NOT NULL)
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discussions_community
    ON discussions (scope, parent_id, is_pinned, created_at)
    WHERE scope = 'community';

CREATE INDEX IF NOT EXISTS idx_discussions_team
    ON discussions (team_id, parent_id, is_pinned, created_at)
    WHERE scope = 'team';

CREATE TABLE IF NOT EXISTS community_access_grants (
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('user', 'team', 'group')),
    subject_id   BIGINT      NOT NULL,
    permission   VARCHAR(16) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'manage')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_community_access_grants_subject
    ON community_access_grants (subject_type, subject_id);
