-- 000002_dynamic_challenges.up.sql
BEGIN;

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS is_dynamic     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image          VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_port  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_ttl    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_limit_mb INTEGER    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpu_limit      INTEGER     NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_challenges_dynamic ON challenges (is_dynamic);

CREATE TABLE IF NOT EXISTS instances (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id   BIGINT       NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  container_id   VARCHAR(128) NOT NULL,
  image          VARCHAR(255) NOT NULL,
  host           VARCHAR(128) NOT NULL,
  port           INTEGER      NOT NULL,
  internal_port  INTEGER      NOT NULL,
  dynamic_flag   TEXT         NOT NULL DEFAULT '',
  status         VARCHAR(16)  NOT NULL DEFAULT 'running',
  error_message  TEXT         NOT NULL DEFAULT '',
  expires_at     TIMESTAMPTZ  NOT NULL,
  started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stopped_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_instances_user      ON instances (user_id);
CREATE INDEX IF NOT EXISTS idx_instances_challenge ON instances (challenge_id);
CREATE INDEX IF NOT EXISTS idx_instances_status    ON instances (status);
CREATE INDEX IF NOT EXISTS idx_instances_expires   ON instances (expires_at);

COMMIT;
