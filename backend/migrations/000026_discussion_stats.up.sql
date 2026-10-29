-- 000026: discussion list metadata for forum-style sorting and counts.

ALTER TABLE discussions
    ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

UPDATE discussions d
SET reply_count = stats.cnt
FROM (
    SELECT parent_id, COUNT(*)::INTEGER AS cnt
    FROM discussions
    WHERE parent_id IS NOT NULL
    GROUP BY parent_id
) stats
WHERE d.id = stats.parent_id AND d.parent_id IS NULL;

UPDATE discussions d
SET last_reply_at = COALESCE(
    (SELECT MAX(r.created_at) FROM discussions r WHERE r.parent_id = d.id),
    d.created_at
)
WHERE d.parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_discussions_forum_order
    ON discussions (scope, parent_id, is_pinned, last_reply_at DESC)
    WHERE parent_id IS NULL;
