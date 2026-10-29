-- 000011: challenge hints (CTFd-style — unlocking a hint costs score on solve)
CREATE TABLE IF NOT EXISTS challenge_hints (
    id            BIGSERIAL    PRIMARY KEY,
    challenge_id  BIGINT       NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    cost_ratio    REAL         NOT NULL DEFAULT 0.0
                  CHECK (cost_ratio >= 0.0 AND cost_ratio <= 1.0),
    content_md    TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hints_challenge ON challenge_hints (challenge_id, sort_order);

-- Each unlock is a permanent record: once a user unlocks a hint, the deduction
-- sticks even if they never solve the challenge. The deduction is computed at
-- solve time as: actual_score = base_dynamic_score * (1 - sum(cost_ratio unlocked)).
CREATE TABLE IF NOT EXISTS hint_unlocks (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       NOT NULL,
    hint_id       BIGINT       NOT NULL REFERENCES challenge_hints(id) ON DELETE CASCADE,
    unlocked_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (user_id, hint_id)
);
CREATE INDEX IF NOT EXISTS idx_hint_unlocks_user  ON hint_unlocks (user_id);
CREATE INDEX IF NOT EXISTS idx_hint_unlocks_hint  ON hint_unlocks (hint_id);
