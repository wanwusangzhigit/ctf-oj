-- 000029: revert discussion topic editing and revision history.

DROP INDEX IF EXISTS idx_discussions_edited;
DROP INDEX IF EXISTS idx_discussion_revisions_actor;
DROP INDEX IF EXISTS idx_discussion_revisions_recent;
DROP INDEX IF EXISTS idx_discussion_revisions_revision;

DELETE FROM discussion_revisions;
DROP TABLE IF EXISTS discussion_revisions;

ALTER TABLE discussions
    DROP COLUMN IF EXISTS edit_count,
    DROP COLUMN IF EXISTS edited_at;
