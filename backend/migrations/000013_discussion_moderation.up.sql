ALTER TABLE discussions
    ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN tags TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_discussions_pinned ON discussions (challenge_id, is_pinned, created_at);
