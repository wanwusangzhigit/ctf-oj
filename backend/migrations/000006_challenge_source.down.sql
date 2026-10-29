-- 000006_challenge_source.down.sql
BEGIN;

ALTER TABLE challenges
  DROP COLUMN IF EXISTS build_context,
  DROP COLUMN IF EXISTS source_type;

COMMIT;
