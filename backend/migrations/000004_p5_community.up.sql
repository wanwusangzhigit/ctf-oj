-- 000004_p5_community.up.sql
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_banned ON users (is_banned);

-- ---------- teams ----------
CREATE TABLE IF NOT EXISTS teams (
  id           BIGSERIAL    PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL UNIQUE,
  slug         VARCHAR(64)  NOT NULL UNIQUE,
  description  TEXT         NOT NULL DEFAULT '',
  owner_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invite_code  VARCHAR(32)  NOT NULL UNIQUE,
  score        INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams (owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_score ON teams (score DESC);

CREATE TABLE IF NOT EXISTS team_members (
  id         BIGSERIAL   PRIMARY KEY,
  team_id    BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- 把现有用户加入团队的总分通过 solves 累计（视图，避免冗余存储）
CREATE OR REPLACE VIEW team_score_view AS
SELECT t.id AS team_id, COALESCE(SUM(s.score), 0) AS computed_score
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
LEFT JOIN solves s ON s.user_id = tm.user_id
GROUP BY t.id;

COMMIT;
