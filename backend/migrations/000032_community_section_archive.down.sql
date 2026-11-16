-- 000032: drop the archive marker. Boards that were archived become visible
-- and postable again; their topic rows were never touched by the up migration.

DROP INDEX IF EXISTS idx_community_sections_archived;

ALTER TABLE community_sections
    DROP COLUMN IF EXISTS archived_at;
