DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS email_verifications;
ALTER TABLE users
    DROP COLUMN verification_sent_at,
    DROP COLUMN email_verified_at,
    DROP COLUMN avatar_storage_key;
