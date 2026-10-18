-- 000002_dynamic_challenges.down.sql
BEGIN;
DROP TABLE IF EXISTS instances;
ALTER TABLE challenges
  DROP COLUMN IF EXISTS cpu_limit,
  DROP COLUMN IF EXISTS memory_limit_mb,
  DROP COLUMN IF EXISTS default_ttl,
  DROP COLUMN IF EXISTS internal_port,
  DROP COLUMN IF EXISTS image,
  DROP COLUMN IF EXISTS is_dynamic;
COMMIT;
