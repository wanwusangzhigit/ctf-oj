-- 000028: competition registration, announcements, and Q&A.

ALTER TABLE competitions
    ADD COLUMN IF NOT EXISTS registration_required BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS competition_registrations (
    competition_id  BIGINT      NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_excluded  BOOLEAN     NOT NULL DEFAULT false,
    excluded_reason TEXT        NOT NULL DEFAULT '',
    excluded_at     TIMESTAMPTZ,
    excluded_by     BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_registrations_user
    ON competition_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_competition_registrations_excluded
    ON competition_registrations (competition_id, user_id)
    WHERE score_excluded = true;

CREATE TABLE IF NOT EXISTS competition_announcements (
    id             BIGSERIAL PRIMARY KEY,
    competition_id BIGINT       NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    title          VARCHAR(160) NOT NULL,
    content_md     TEXT         NOT NULL DEFAULT '',
    is_published   BOOLEAN      NOT NULL DEFAULT true,
    created_by     BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_announcements_competition
    ON competition_announcements (competition_id, is_published, created_at DESC);

ALTER TABLE discussions
    ADD COLUMN IF NOT EXISTS competition_id BIGINT REFERENCES competitions(id) ON DELETE CASCADE;

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_scope_check;
ALTER TABLE discussions
    ADD CONSTRAINT discussions_scope_check
    CHECK (scope IN ('challenge', 'community', 'team', 'competition'));

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_target_check;
ALTER TABLE discussions
    ADD CONSTRAINT discussions_target_check
    CHECK (
        (scope = 'challenge' AND challenge_id IS NOT NULL AND team_id IS NULL AND competition_id IS NULL) OR
        (scope = 'community' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NULL) OR
        (scope = 'team' AND challenge_id IS NULL AND team_id IS NOT NULL AND competition_id IS NULL) OR
        (scope = 'competition' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_discussions_competition
    ON discussions (competition_id, parent_id, is_pinned, created_at)
    WHERE scope = 'competition';
