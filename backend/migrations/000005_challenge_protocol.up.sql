-- 000005_challenge_protocol.up.sql
BEGIN;

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS protocol VARCHAR(16) NOT NULL DEFAULT 'tcp';

COMMIT;
