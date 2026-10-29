DROP INDEX IF EXISTS idx_discussions_forum_order;

ALTER TABLE discussions
    DROP COLUMN IF EXISTS last_reply_at,
    DROP COLUMN IF EXISTS reply_count,
    DROP COLUMN IF EXISTS view_count;
