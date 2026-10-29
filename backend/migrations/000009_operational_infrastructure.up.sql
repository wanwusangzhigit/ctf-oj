-- 000009: operational infrastructure — site settings + audit log + competitions.
CREATE TABLE IF NOT EXISTS site_settings (
    key         VARCHAR(64)  PRIMARY KEY,
    value       TEXT         NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  BIGINT
);

-- Seed a few defaults so the frontend can read them on first boot.
INSERT INTO site_settings (key, value) VALUES
    ('site.name',          'CTF-OJ'),
    ('site.tagline',       '面向 CTF 练习的在线评测平台'),
    ('site.rules_md',      ''),
    ('site.registration_open', 'true'),
    ('site.registration_code', ''),
    ('auth.email_verification_required', 'false'),
    ('auth.password_reset_enabled',      'false'),
    ('competition.active_id', '0')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL    PRIMARY KEY,
    actor_id     BIGINT       NOT NULL DEFAULT 0,
    actor_name   VARCHAR(64)  NOT NULL DEFAULT '',
    action       VARCHAR(64)  NOT NULL,
    target_type  VARCHAR(32)  NOT NULL DEFAULT '',
    target_id    BIGINT       NOT NULL DEFAULT 0,
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ip           VARCHAR(64)  NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target   ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS competitions (
    id                  BIGSERIAL    PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,
    slug                VARCHAR(64)  NOT NULL UNIQUE,
    description         TEXT         NOT NULL DEFAULT '',
    start_at            TIMESTAMPTZ,
    end_at              TIMESTAMPTZ,
    freeze_at           TIMESTAMPTZ,
    registration_code   VARCHAR(64)  NOT NULL DEFAULT '',
    is_active           BOOLEAN      NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitions_active ON competitions (is_active, start_at, end_at);
