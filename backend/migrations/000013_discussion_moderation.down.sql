DROP INDEX IF EXISTS idx_discussions_pinned;
ALTER TABLE discussions
    DROP COLUMN IF EXISTS is_pinned,
    DROP COLUMN IF EXISTS is_locked,
    DROP COLUMN IF EXISTS tags;
