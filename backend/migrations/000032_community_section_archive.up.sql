-- 000032: archive community boards instead of refusing to delete them while
-- they still hold topics. An archived board keeps its rows (and its topics)
-- but disappears from the public board list and cannot accept new posts.
-- This is structure only — no board rows are seeded or changed here.

ALTER TABLE community_sections
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_community_sections_archived
    ON community_sections (archived_at)
    WHERE archived_at IS NOT NULL;
