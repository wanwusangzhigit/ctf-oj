DROP INDEX IF EXISTS idx_submissions_competition;
ALTER TABLE submissions DROP COLUMN IF EXISTS competition_id;

DROP INDEX IF EXISTS idx_competition_solves_challenge;
DROP INDEX IF EXISTS idx_competition_solves_user;
DROP INDEX IF EXISTS idx_competition_solves_competition;
DROP TABLE IF EXISTS competition_solves;
