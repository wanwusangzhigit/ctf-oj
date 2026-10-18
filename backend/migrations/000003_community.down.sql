-- 000003_community.down.sql
BEGIN;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS discussion_likes;
DROP TABLE IF EXISTS discussions;
DROP TABLE IF EXISTS announcements;
COMMIT;
