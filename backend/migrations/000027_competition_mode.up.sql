-- 000027: separate competition solves from practice solves.

CREATE TABLE IF NOT EXISTS competition_solves (
    id             BIGSERIAL PRIMARY KEY,
    competition_id BIGINT      NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id   BIGINT      NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    score          INTEGER     NOT NULL DEFAULT 0,
    is_first_blood BOOLEAN     NOT NULL DEFAULT false,
    solved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_competition_solve UNIQUE (competition_id, user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_solves_competition
    ON competition_solves (competition_id, solved_at);
CREATE INDEX IF NOT EXISTS idx_competition_solves_user
    ON competition_solves (user_id);
CREATE INDEX IF NOT EXISTS idx_competition_solves_challenge
    ON competition_solves (challenge_id);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS competition_id BIGINT REFERENCES competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_competition
    ON submissions (competition_id);
