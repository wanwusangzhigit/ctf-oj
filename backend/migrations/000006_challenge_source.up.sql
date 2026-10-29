-- 000006_challenge_source.up.sql
BEGIN;

-- 容器化题目来源类型：
--   image     现有模式，直接 pull 第三方镜像
--   dockerfile 上传 Dockerfile + 上下文文件，启动时构建
--   compose   上传 docker-compose.yml + 相关文件，启动时 docker compose up
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS source_type    VARCHAR(16) NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS build_context  VARCHAR(255) NOT NULL DEFAULT '';

COMMENT ON COLUMN challenges.source_type   IS 'image / dockerfile / compose';
COMMENT ON COLUMN challenges.build_context IS '镜像名称(image)或构建上下文路径(dockerfile/compose)；空表示使用题目源目录';

COMMIT;
