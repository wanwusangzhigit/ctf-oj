-- 000005_challenge_protocol.down.sql
BEGIN;

ALTER TABLE challenges DROP COLUMN IF EXISTS protocol;

COMMIT;
