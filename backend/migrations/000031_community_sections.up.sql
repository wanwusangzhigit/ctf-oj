-- 000031: community board sections — directory table, per-section grants, and the
-- mandatory discussions.section_id for scope='community'.

CREATE TABLE IF NOT EXISTS community_sections (
    id             BIGSERIAL    PRIMARY KEY,
    name           VARCHAR(64)  NOT NULL UNIQUE,
    blurb          VARCHAR(255) NOT NULL DEFAULT '',
    guidelines_md  TEXT         NOT NULL DEFAULT '',
    -- '' means "inherit the station-wide policy"; a stored value overrides it.
    visibility     VARCHAR(16)  NOT NULL DEFAULT ''
        CONSTRAINT community_sections_visibility_check CHECK (visibility IN ('','public','members','restricted')),
    posting        VARCHAR(16)  NOT NULL DEFAULT ''
        CONSTRAINT community_sections_posting_check CHECK (posting IN ('','members','restricted')),
    sort_order     INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_sections_order
    ON community_sections (sort_order, id);

CREATE TABLE IF NOT EXISTS community_section_grants (
    section_id   BIGINT      NOT NULL REFERENCES community_sections(id) ON DELETE CASCADE,
    subject_type VARCHAR(16) NOT NULL CHECK (subject_type IN ('user','team','group')),
    subject_id   BIGINT      NOT NULL,
    permission   VARCHAR(16) NOT NULL DEFAULT 'view' CHECK (permission IN ('view','manage')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (section_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_community_section_grants_subject
    ON community_section_grants (subject_type, subject_id);

-- Structural defaults for the board directory (same family as the site_settings
-- defaults in 000009), not sample content: guarded so a hand re-run of this file
-- cannot duplicate them, and they stay ordinary rows once created — an admin who
-- deletes every section never gets them back.
INSERT INTO community_sections (name, blurb, guidelines_md, sort_order)
SELECT v.name, v.blurb, v.guidelines_md, v.sort_order
FROM (VALUES
    ('站务版', '公告、反馈与板块事务。', '涉及站务、板块调整与申诉，请附具体时间与截图。', 10),
    ('求助版', '卡题了？写清题目来源与已尝试的思路。', '请给出题目名称或链接、已尝试的方法与卡住的环节；不要直接索要 flag。', 20),
    ('灌水版', '闲聊、赛事吐槽与水区。', '请勿刷屏、人身攻击或张贴未标注的 flag。', 30),
    ('讨论交流版', 'Writeup、解法与技术分享。', '引用他人内容请注明来源；涉及进行中赛事的题目请走赛事答疑。', 40)
) AS v(name, blurb, guidelines_md, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM community_sections);

-- Nullable first: every existing row is NULL, so the foreign key validates
-- without touching data, and the other three scopes keep NULL for good.
ALTER TABLE discussions
    ADD COLUMN IF NOT EXISTS section_id BIGINT REFERENCES community_sections(id) ON DELETE RESTRICT;

-- Backfill before the CHECK is re-added. Selecting the seeded row by name is safe
-- here: the table was created by this same file and transaction, so the only rows
-- carrying that name are the ones inserted above.
UPDATE discussions d SET section_id = s.id
  FROM community_sections s
 WHERE d.scope = 'community' AND d.parent_id IS NULL AND d.section_id IS NULL AND s.name = '站务版';

UPDATE discussions d SET section_id = p.section_id
  FROM discussions p
 WHERE d.parent_id = p.id AND d.section_id IS NULL AND p.section_id IS NOT NULL;

ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_target_check;
ALTER TABLE discussions
    ADD CONSTRAINT discussions_target_check
    CHECK (
        (scope = 'challenge' AND challenge_id IS NOT NULL AND team_id IS NULL AND competition_id IS NULL AND section_id IS NULL) OR
        (scope = 'community' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NULL AND section_id IS NOT NULL) OR
        (scope = 'team' AND challenge_id IS NULL AND team_id IS NOT NULL AND competition_id IS NULL AND section_id IS NULL) OR
        (scope = 'competition' AND challenge_id IS NULL AND team_id IS NULL AND competition_id IS NOT NULL AND section_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_discussions_community_section
    ON discussions (section_id, is_pinned, last_reply_at DESC NULLS LAST, created_at DESC)
    WHERE scope = 'community' AND parent_id IS NULL;
