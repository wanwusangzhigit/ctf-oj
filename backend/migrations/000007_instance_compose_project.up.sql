-- 000007_instance_compose_project.up.sql
BEGIN;

ALTER TABLE instances
  ADD COLUMN IF NOT EXISTS compose_project VARCHAR(64) NOT NULL DEFAULT '';

COMMIT;
