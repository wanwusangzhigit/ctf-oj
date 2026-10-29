-- 000024: scoped view/manage permissions for challenges and competitions.

ALTER TABLE challenge_access_grants
    ADD COLUMN IF NOT EXISTS permission VARCHAR(16) NOT NULL DEFAULT 'view';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'challenge_access_grants_permission_check'
    ) THEN
        ALTER TABLE challenge_access_grants
            ADD CONSTRAINT challenge_access_grants_permission_check
            CHECK (permission IN ('view', 'manage'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS competition_access_grants (
    competition_id BIGINT      NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    subject_type   VARCHAR(16) NOT NULL CHECK (subject_type IN ('user', 'team', 'group')),
    subject_id     BIGINT      NOT NULL,
    permission     VARCHAR(16) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'manage')),
    PRIMARY KEY (competition_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_access_grants_subject
    ON competition_access_grants (subject_type, subject_id);
