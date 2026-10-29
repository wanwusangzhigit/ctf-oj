-- 000008: persist last-known container logs so admins can review
--         instances after the underlying container has been torn down.
ALTER TABLE instances
  ADD COLUMN logs_snapshot TEXT NOT NULL DEFAULT '';
