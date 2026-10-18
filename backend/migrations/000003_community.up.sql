-- 000003_community.up.sql
BEGIN;

-- ---------- announcements ----------
CREATE TABLE IF NOT EXISTS announcements (
  id             BIGSERIAL    PRIMARY KEY,
  title          VARCHAR(255) NOT NULL,
  content_md     TEXT         NOT NULL DEFAULT '',
  is_pinned      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_published   BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at   TIMESTAMPTZ,
  created_by     BIGINT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements (is_published, published_at DESC);

-- ---------- discussions ----------
CREATE TABLE IF NOT EXISTS discussions (
  id            BIGSERIAL   PRIMARY KEY,
  challenge_id  BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id     BIGINT      REFERENCES discussions(id) ON DELETE CASCADE,
  content_md    TEXT        NOT NULL,
  like_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discussions_challenge ON discussions (challenge_id, parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_user      ON discussions (user_id);

CREATE TABLE IF NOT EXISTS discussion_likes (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discussion_id  BIGINT    NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, discussion_id)
);

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        VARCHAR(32)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT         NOT NULL DEFAULT '',
  link        VARCHAR(255) NOT NULL DEFAULT '',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read_at, created_at DESC);

COMMIT;
