-- 000012: challenge editorial + process limit
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS editorial_md TEXT NOT NULL DEFAULT '';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS pids_limit INTEGER NOT NULL DEFAULT 0;
