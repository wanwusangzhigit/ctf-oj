# memory.md

项目工作记忆与状态记录。每次会话开始时先读这份文件，了解当前进展。

## 当前状态

**阶段**：P1 + P2 + P3 + P4 社区模块 已完成并通过端到端验证
**最后更新**：2026-10-18

## 已完成功能

### P1 地基
- [x] `docker-compose.yml`（postgres、redis、backend、worker、frontend、caddy）
- [x] 配置加载、结构化日志、GORM 连接池、Redis 客户端
- [x] 数据库迁移脚本（时间戳命名纯 SQL）
- [x] JWT 鉴权、注册/登录/刷新接口
- [x] 中间件：auth/optionalAuth/CORS/限流/日志/恢复

### P2 核心题目
- [x] 领域模型：User、Category、Challenge、Flag、Attachment、Submission、Solve
- [x] 分类/题目 CRUD（管理员）
- [x] 题目列表（自动过滤未发布）/ 详情
- [x] Flag 提交：static / regex，含大小写敏感
- [x] 动态打分（CTFd 衰减公式）
- [x] 附件上传与下载
- [x] 提交频率限制、First Blood、解题榜

### P3 容器化题目
- [x] Docker 编排器（CLI 调 docker.sock）
- [x] 动态 Flag 注入（`flag{uuid}` 通过 `FLAG` 环境变量）
- [x] 端口分配（30000-40000 范围随机）
- [x] 实例表与状态机（running/stopped/expired/error）
- [x] 实例 API：start / getActive / extend / stop / list mine
- [x] Worker 定时清理过期实例（默认 30s 间隔）
- [x] 容器资源限制（memory / cpus）
- [x] 同用户同题至多 1 个活跃实例（可配置）

### P4 社区模块
- [x] 公告系统：`announcements` 表，admin CRUD，置顶字段，发布时间
  - API：`GET /announcements`、`GET /announcements/:id`、`POST/PUT/DELETE`（admin）
  - 前端：`/announcements` 列表页、`/announcements/:id` 详情页（Markdown 渲染）
  - 首页置顶公告条 + 最新 3 条
  - Admin 后台：`/admin/announcements` 管理（编辑器 + 列表）
- [x] 讨论区：`discussions` + `discussion_likes` 表，单层嵌套回复
  - API：`GET/POST /challenges/:id/discussions`、`POST /discussions/:id/like`、`DELETE /discussions/:id`
  - 前端：题目详情底部 `DiscussionPanel` 组件（评论 + 回复 + 点赞 + 删除）
  - Markdown 渲染，支持 GFM（表格/列表/代码块）
- [x] Markdown 渲染：`react-markdown` + `remark-gfm` + `rehype-sanitize`
  - 服务端只存原文 `content_md`，前端渲染避免存储型 XSS
  - 题目描述、公告、讨论均使用 Markdown
- [x] 通知系统：`notifications` 表
  - 触发场景：解题（含首杀标记）、回复评论
  - API：`GET /notifications/me`、`GET /notifications/me/unread_count`、`PATCH /notifications/:id/read`、`POST /notifications/read_all`
  - 前端：顶部导航通知铃铛（30s 轮询未读数，下拉显示最新 5 条）、`/notifications` 通知中心（分类筛选 + 单条/全部已读）

### 前端（HydroOJ 现代简洁风）
- [x] Vite + React + TS + Tailwind 骨架
- [x] 设计令牌（中性灰 + 靛蓝强调色，亮/暗双主题跟随系统）
- [x] 基础 UI 组件：Button、Input、Textarea、Field、Card、Badge、Spinner、Toast
- [x] 路由 + 鉴权守卫（RequireAuth、RequireAdmin、PublicOnly）
- [x] Axios 拦截器 + 自动刷新 token + TanStack Query + Zustand auth store
- [x] 登录 / 注册页面（左侧介绍 + 右侧表单的简洁布局）
- [x] 主布局（顶部导航 + 通知铃铛 + 选手信息 + footer）
- [x] 首页（统计卡片 + 置顶/最新公告 + 最新题目 + Top5 榜单）
- [x] 题目列表（分类筛选 + 搜索 + 卡片网格 + 容器题标记）
- [x] 题目详情（描述 Markdown、附件、提交 Flag、动态实例面板、讨论区）
- [x] 我的实例页面、榜单页、个人主页
- [x] 公告列表 + 详情、通知中心
- [x] 404 页面
- [x] 管理后台（分类 CRUD + 题目创建/删除支持静态与容器化 + 公告管理）

### 部署与运维
- [x] 多阶段 Dockerfile（backend & worker 共用 alpine + docker-cli）
- [x] Caddy 反代 `/api` → backend、其余 → frontend
- [x] 完整 `make up` / `make up-prod` / `make migrate` 工作流
- [x] backend / worker 容器挂载 `/var/run/docker.sock`
- [x] 端到端联调验证通过

## 未实现 / 待办

### P5 管理 + 高级
- [ ] Admin UI：附件管理界面、题目编辑回填（接口均已实现）
- [ ] 实时记分板（WebSocket）
- [ ] 统计图表
- [ ] 数据导入导出
- [ ] 团队系统

## 关键决策记录

- **2026-10-17**：选用 Go + React + PostgreSQL；首期只做 Flag 模式；不内置任何示例数据。
- **2026-10-17**：UI 设计中性灰 + 靛蓝强调色，统一 1px 边框 + 6~8px 圆角，避免渐变与霓虹；亮/暗双主题跟随系统。
- **2026-10-17**：迁移使用纯 SQL 而非 GORM AutoMigrate，便于审计与回滚。
- **2026-10-17**：附件路由最终调整为 `/challenges/:id/attachments/:attachmentId/...` 以避免 Gin 路径参数冲突。
- **2026-10-17**：Docker Compose 中 postgres/redis 不向宿主暴露端口。
- **2026-10-17**：放弃 docker/docker SDK，改用 docker-cli 子进程调用 docker.sock。
- **2026-10-18**：Markdown 服务端只存原文 `content_md`，前端用 react-markdown + rehype-sanitize 渲染，避免存储型 XSS。
- **2026-10-18**：讨论区采用单层嵌套（顶层 + 一层回复），简化前端渲染与查询；回复时自动给父评论作者派发通知。
- **2026-10-18**：通知采用拉模式（30s 轮询未读数），未引入 WebSocket；P5 引入实时记分板时再升级。

## 已知问题

- 暂无（如发现请在此记录）

## 端到端验证清单（最近一次）

通过 `docker compose up -d --build` + 应用三个迁移后：
- ✅ `POST /api/v1/announcements` 创建公告（Markdown 内容）
- ✅ `GET /api/v1/announcements` 列表正确返回
- ✅ `POST /api/v1/challenges/:id/discussions` 创建顶层评论
- ✅ `POST .../discussions` 带 parentId 创建回复（单层嵌套校验）
- ✅ `POST /api/v1/discussions/:id/like` 切换点赞状态
- ✅ `POST /api/v1/challenges/:id/submit` 正确 flag → 自动派发解题通知
- ✅ `GET /api/v1/notifications/me` 返回通知（首杀标记）
- ✅ `GET /api/v1/notifications/me/unread_count` 返回未读数
- ✅ `PATCH /api/v1/notifications/:id/read` 标记已读
- ✅ `POST /api/v1/notifications/read_all` 全部已读

## 开发常用命令

```bash
make up              # 启动依赖（postgres、redis）
make up-prod         # 构建并启动全部服务
make backend-dev     # 后端热重载
make frontend-dev    # 前端开发服务器
make migrate         # 应用 SQL 迁移
make logs / make down / make clean / make fmt / make vet / make test
```

应用迁移的便捷方式：

```bash
for f in backend/migrations/*.up.sql; do
  docker compose exec -T postgres sh -c "psql -U ctfoj -d ctfoj -f -" < "$f"
done
```

## 待用户决策

- 是否需要团队系统（当前仅个人打分）
- 是否需要 OAuth（GitHub）登录
- 附件存储是否需要 S3 / MinIO 后端
- 容器题目是否使用专用网络隔离
- 是否引入 WebSocket 替代通知轮询（当前用默认 bridge）
