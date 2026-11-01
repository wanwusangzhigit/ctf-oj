-- 000030: the 'competition_admin' role is 17 characters and does not fit VARCHAR(16).

ALTER TABLE users
    ALTER COLUMN role TYPE VARCHAR(32);
