-- 000030: restore the original width, but never truncate a role value away.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE char_length(role) > 16) THEN
        RAISE EXCEPTION 'users.role stores values longer than 16 characters; refusing to truncate';
    END IF;
END $$;

ALTER TABLE users
    ALTER COLUMN role TYPE VARCHAR(16);
