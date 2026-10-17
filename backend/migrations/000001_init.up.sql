-- 000001_init.up.sql
-- 初始 schema：用户、分类、题目、Flag、附件、提交、解题记录

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    bio           TEXT         NOT NULL DEFAULT '',
    role          VARCHAR(16)  NOT NULL DEFAULT 'user',
    score         INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_score ON users (score DESC);

-- ---------- categories ----------
CREATE TABLE IF NOT EXISTS categories (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(64) NOT NULL UNIQUE,
    slug        VARCHAR(64) NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- challenges ----------
CREATE TABLE IF NOT EXISTS challenges (
    id               BIGSERIAL PRIMARY KEY,
    category_id      BIGINT      NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title            VARCHAR(128) NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    base_score       INTEGER     NOT NULL DEFAULT 500,
    min_score        INTEGER     NOT NULL DEFAULT 100,
    decay            INTEGER     NOT NULL DEFAULT 10,
    difficulty       INTEGER     NOT NULL DEFAULT 2,
    is_published     BOOLEAN     NOT NULL DEFAULT FALSE,
    connection_info  VARCHAR(255) NOT NULL DEFAULT '',
    tags             VARCHAR(255) NOT NULL DEFAULT '',
    created_by       BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_challenges_category   ON challenges (category_id);
CREATE INDEX IF NOT EXISTS idx_challenges_published ON challenges (is_published);

-- ---------- flags ----------
CREATE TABLE IF NOT EXISTS flags (
    id             BIGSERIAL PRIMARY KEY,
    challenge_id   BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    type           VARCHAR(16) NOT NULL DEFAULT 'static',
    content        TEXT        NOT NULL,
    case_sensitive BOOLEAN     NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_flags_challenge ON flags (challenge_id);

-- ---------- attachments ----------
CREATE TABLE IF NOT EXISTS attachments (
    id           BIGSERIAL PRIMARY KEY,
    challenge_id BIGINT       NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    filename     VARCHAR(255) NOT NULL,
    storage_key  VARCHAR(128) NOT NULL,
    mime_type    VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
    size         BIGINT       NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_challenge ON attachments (challenge_id);

-- ---------- submissions ----------
CREATE TABLE IF NOT EXISTS submissions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    flag         TEXT        NOT NULL,
    is_correct   BOOLEAN     NOT NULL DEFAULT FALSE,
    ip           VARCHAR(64) NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submissions_user      ON submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions (challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created   ON submissions (created_at);

-- ---------- solves ----------
CREATE TABLE IF NOT EXISTS solves (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id    BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    score           INTEGER     NOT NULL,
    is_first_blood  BOOLEAN     NOT NULL DEFAULT FALSE,
    solved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, challenge_id)
);
CREATE INDEX IF NOT EXISTS idx_solves_challenge ON solves (challenge_id);
CREATE INDEX IF NOT EXISTS idx_solves_user      ON solves (user_id);
CREATE INDEX IF NOT EXISTS idx_solves_solved_at ON solves (solved_at);

COMMIT;
