-- 000023: hidden challenge access control — permission groups and grants.

CREATE TABLE IF NOT EXISTS challenge_groups (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(64)  NOT NULL UNIQUE,
    description TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_group_members (
    group_id     BIGINT      NOT NULL REFERENCES challenge_groups(id) ON DELETE CASCADE,
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('user', 'team')),
    subject_id   BIGINT      NOT NULL,
    PRIMARY KEY (group_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_group_members_subject
    ON challenge_group_members (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS challenge_access_grants (
    challenge_id BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('user', 'team', 'group')),
    subject_id   BIGINT      NOT NULL,
    PRIMARY KEY (challenge_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_access_grants_subject
    ON challenge_access_grants (subject_type, subject_id);
