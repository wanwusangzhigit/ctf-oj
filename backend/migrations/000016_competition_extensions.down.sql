DROP TABLE IF EXISTS competition_challenges;
ALTER TABLE competitions
    DROP COLUMN IF EXISTS visibility,
    DROP COLUMN IF EXISTS archived_at;
