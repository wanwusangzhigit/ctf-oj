ALTER TABLE competitions
    ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'public',
    ADD COLUMN archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS competition_challenges (
    competition_id BIGINT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    challenge_id   BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    sort_order     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (competition_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_challenges_challenge
    ON competition_challenges (challenge_id);
