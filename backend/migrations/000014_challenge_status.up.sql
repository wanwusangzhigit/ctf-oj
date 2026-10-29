ALTER TABLE challenges
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'draft';

UPDATE challenges
SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

CREATE INDEX idx_challenges_status ON challenges (status);
