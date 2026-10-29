CREATE TABLE IF NOT EXISTS writeups (
    id           BIGSERIAL PRIMARY KEY,
    challenge_id BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(160) NOT NULL,
    content_md   TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writeups_challenge ON writeups (challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_writeups_user ON writeups (user_id);
