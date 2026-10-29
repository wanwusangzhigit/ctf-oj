ALTER TABLE users ADD COLUMN score_excluded BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_users_score_excluded ON users (score_excluded);
