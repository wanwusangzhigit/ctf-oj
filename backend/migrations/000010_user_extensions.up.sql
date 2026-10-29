-- 000010: user account extensions + auth tokens (email verification & password reset)
ALTER TABLE users
    ADD COLUMN avatar_storage_key    VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN email_verified_at     TIMESTAMPTZ,
    ADD COLUMN verification_sent_at  TIMESTAMPTZ;

-- Separate token tables share the same shape but live apart for clarity & TTL.
CREATE TABLE IF NOT EXISTS email_verifications (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    token        VARCHAR(64)  NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ  NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verifs_user ON email_verifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    token        VARCHAR(64)  NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ  NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pwresets_user ON password_resets (user_id, created_at DESC);
