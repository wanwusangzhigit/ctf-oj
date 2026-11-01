-- 000029: discussion topic editing with revision history.

ALTER TABLE discussions
    ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS discussion_revisions (
    id            BIGSERIAL    PRIMARY KEY,
    discussion_id BIGINT       NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    revision      INTEGER      NOT NULL,
    title         VARCHAR(160) NOT NULL DEFAULT '',
    content_md    TEXT         NOT NULL DEFAULT '',
    actor_id      BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE discussion_revisions DROP CONSTRAINT IF EXISTS discussion_revisions_revision_check;
ALTER TABLE discussion_revisions
    ADD CONSTRAINT discussion_revisions_revision_check CHECK (revision >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discussion_revisions_revision
    ON discussion_revisions (discussion_id, revision);
CREATE INDEX IF NOT EXISTS idx_discussion_revisions_recent
    ON discussion_revisions (discussion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_revisions_actor
    ON discussion_revisions (actor_id);

CREATE INDEX IF NOT EXISTS idx_discussions_edited
    ON discussions (edited_at DESC)
    WHERE edited_at IS NOT NULL;
