-- 000007_instance_compose_project.down.sql
BEGIN;

ALTER TABLE instances DROP COLUMN IF EXISTS compose_project;

COMMIT;
