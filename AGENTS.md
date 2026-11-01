# AGENTS.md

本文件用于指导 AI 协作者（包括 opencode 自身）在本仓库中工作。阅读它应能独立完成绝大多数开发任务，无需再次询问约定。

## 项目一句话

CTF-OJ 是一个面向 CTF 练习的在线评测系统，对标 HydroOJ，使用 Go + React + PostgreSQL。

## 关键约束（务必遵守）

1. **不要内置数据**：迁移只创建表结构与索引，不写入任何示例题目 / 用户 / 公告。所有数据通过 UI 或脚本由使用者自行创建。
2. **前端不展示未实现功能**：UI 上能看到的入口必须有真实的 API 与逻辑支撑。尚未实现的能力，要么不出现在界面上，要么明确标记「即将上线」并禁用交互。**严禁出现幻觉式展示**。
3. **避免 AI 味 UI**：
   - 不要使用渐变色背景、霓虹光、glassmorphism、emoji 图标。
   - 配色使用 `frontend/src/styles/tokens.css` 中的设计令牌；不要在组件里硬编码十六进制色值。
   - 圆角、阴影、间距统一走 Tailwind 预设与令牌。
   - 字体仅使用 Inter（西文）+ 系统中文回退；不要引入花哨字体。
   - 前端不得依赖外部运行时资源（CDN、Google Fonts、外部图片/脚本）；字体等静态资源必须放入仓库并本地加载。
   - 不写"powerful / elegant / seamless"等空泛形容词，代码注释保持简洁。
4. **代码风格**：
   - Go：遵循 [Effective Go](https://go.dev/doc/effective_go)；错误处理使用 `errors.Wrap` 风格；不写无意义注释。
   - TS：严格模式；优先 `type` 而非 `interface` 除非需要合并；禁止 `any`，必要时用 `unknown`。
   - 提交信息使用 Conventional Commits（feat / fix / chore / docs / refactor / test）。
5. **文档先行**：每次完成一个里程碑，更新 `memory.md` 的"当前状态"与"已完成功能"两节。

## 目录约定

```
backend/
  cmd/                  仅包含 main.go 入口
  internal/
    api/v1/             HTTP handler，按资源分文件
    api/middleware/     中间件
    domain/             领域实体与仓储接口（不依赖具体实现）
    service/            业务逻辑
    repository/         GORM 仓储实现
    infrastructure/     db / cache / storage / docker 等
    config/             配置加载
    pkg/                通用工具（与业务无关）
  migrations/           纯 SQL 迁移，按时间戳命名
frontend/
  src/
    api/                axios 封装与请求函数
    components/ui/      基础 UI 组件（Button / Input / Card ...）
    components/         业务组件
    pages/              路由页面
    hooks/              自定义 hook
    stores/             Zustand store
    lib/                工具函数
    types/              全局类型
    styles/             设计令牌、全局样式
```

## 分层规则

- `api` 只做参数校验、调用 service、返回结果，**不直接访问仓储**。
- `service` 编排业务逻辑，依赖 `domain` 接口，不直接依赖 `repository`。
- `repository` 实现仓储接口，唯一可以依赖 GORM 的地方。
- 跨层依赖只能向内：api → service → domain ← repository。

## 数据库迁移

- 使用纯 SQL 文件，文件名 `NNNNNN_description.up.sql` / `NNNNNN_description.down.sql`。
- 应用启动时不自动迁移；通过 `make migrate` 显式执行。
- 应用启动时会执行一次 `PRAGMA`/连接探活，但不修改 schema。

## API 规范

- 统一前缀 `/api/v1`。
- 统一响应体：
  ```json
  { "code": 0, "data": {...}, "message": "ok" }
  ```
  业务错误 `code != 0`；HTTP 状态码语义化（200/201/400/401/403/404/409/500）。
- 鉴权默认使用 HttpOnly cookie（`ctf_oj_access` / `ctf_oj_refresh`），同时兼容 `Authorization: Bearer <accessToken>`；刷新令牌走 `POST /api/v1/auth/refresh`，登出走 `POST /api/v1/auth/logout`。
- 列表接口必须分页：`?page=1&page_size=20`，返回 `{ items, total, page, page_size }`。
- 题目/赛事授权使用 `permission: view | manage`；`manage` 隐含 `view`。`/users/me` 与登录响应返回 `delegations`（`resourceType` / `resourceId` / `permission`）。
- 社区讨论权限使用独立的 `community_access_grants`：`view` 允许读取受限社区，`manage` 允许发帖、置顶、锁定与删除；全局管理权限为 `community.manage`，社区/题目 moderation 还接受 `discussion.moderate`。
- 被授权者走同一 `/admin` 路由，但仅开放其授权资源；创建/删除、导出成绩、激活/归档、修改可见性/发布状态、调整授权列表仍仅限全局管理员。
- 被授权操作写入审计时，payload 追加 `delegated: true` 与 `grant`（如 `challenge:12:manage`）。
- 讨论区按 `scope` 分为 `challenge` / `community` / `team` / `competition`；团队讨论仅团队成员可读写，队长可 moderation。
- 社区讨论列表支持 `sort=last_reply|newest|oldest`、`tag`、`q`；`GET /community/discussions/:id` 返回主题与全部楼层并递增浏览数。
- 赛事报名由 `registration_required` 控制（默认 false）。报名码非空时必须匹配；赛事结束或归档后不可报名，开赛后不可取消报名。未报名不能提交赛事题或发起赛事答疑；`discussion.moderate` 与赛事管理者免报名。
- 赛事公告独立于全局公告：公开列表只返回已发布公告，管理端可查看草稿。取消成绩按赛事记录在 `competition_registrations.score_excluded`，排行榜过滤该用户，管理端可恢复；被取消成绩用户不能提交赛事题或发起赛事答疑。
- 赛事报名/公告/取消成绩 API：`GET /competitions/:id/registration`、`POST/DELETE /competitions/:id/register`、`GET /competitions/:id/announcements`、`GET/POST /competitions/:id/discussions`；管理端 `GET /admin/competitions/:id/registrations`、`PATCH /admin/competitions/:id/registrations/:userId`、`GET/POST/PUT/DELETE /admin/competitions/:id/announcements`、`PATCH /admin/competitions/:id/discussions/:discussionId`。
- 赛事时间必须满足 `start_at < end_at`，`freeze_at` 若存在必须落在 `[start_at, end_at]`；名称与 slug 必填，否则返回 400。
- 封榜：封榜后至结束前，公开赛事榜只统计 `solved_at <= freeze_at` 的解题；管理员与赛事管理者看实时榜，结束后所有人看完整榜。赛事详情/列表返回 `scoreboardFrozen`，导出成绩按实时榜处理。
- 计分在提交时确定并写入 `competition_solves.score`：`fixed` 取 `base_score`；`three_blood` 对第 1/2/3 个解出分别加 10%/5%/2%；`dynamic` 按解出人数衰减。赛事榜汇总已存储分数，不再按当前题目分值重算。
- 比赛解题与练习解题分离：练习写 `solves` 并更新用户全局分；赛事写 `competition_solves`，不更新全局分。`submissions.competition_id` 为空表示练习提交。
- `GET /challenges/:id?competition_id=ID` 返回 `competitionSolved` / `competitionScore`；`POST /challenges/:id/submit` 接受 `{ flag, competitionId? }`。
- 未显式传 `competitionId` 时按练习模式处理；显式 ID 必须对应 active、live、包含该题的赛事。已解出后可重复提交，返回 `score=0` 与 `alreadySolved=true`，不重复计分。
- 隐藏题仅在携带 `competition_id` 且对应赛事 live、未归档、显式绑定该题时可见；无赛事上下文仍返回 404。公开题无上下文按普通模式访问。
- `GET /challenges` 支持 `competition_id`，并返回 `competitionId` / `competitionSolved` / `competitionScore`；赛事详情据此标注「已通过」「比赛已解出」「赛事题」。`/challenges` 列表不带赛事上下文，进入题目不携带 `?competition`。
- 容器化题目已通过后仍可重新启动实例以重做；比赛模式按 `competitionSolved` 判断实例状态，练习已通过不阻止赛事重做。

## 前端约定

- 路由：`/auth/*`、`/`、`/challenges`、`/challenges/:id`（题目）、`/challenges/:id/writeups`、`/challenges/:id/discussions`、`/competitions`、`/competitions/:id`（概览）、`/competitions/:id/challenges`、`/competitions/:id/scoreboard`、`/competitions/:id/announcements`、`/competitions/:id/discussions`、`/scoreboard`、`/scoreboard/realtime`、`/stats`、`/search`、`/community`、`/community/:id`、`/teams`、`/teams/:id`、`/teams/scoreboard`、`/announcements*`、`/notifications`、`/instances`、`/users/:id`、`/admin/*`。
- 公开路由：`/auth/*`、`/`、`/challenges` 列表、`/competitions*`、`/scoreboard*`、`/stats`、`/search`、`/community`、`/community/:id`、`/teams/scoreboard`、`/announcements*`；其余需登录，后台按权限守卫。
- 后台守卫需同时支持全局权限与 `delegations`：`RequireChallengeManage` / `RequireCompetitionManage` 允许对应资源的管理授权；无资源 id 的列表路由允许任一该类型授权。社区权限页使用 `community.manage`。
- 全局错误使用 toast，不在页面层处理业务错误细节。
- 表单使用 `react-hook-form` + `zod` 校验。
- 数据请求统一走 TanStack Query；本地状态走 Zustand。
- 富文本一律走 `Markdown` 组件（react-markdown + rehype-sanitize）；不允许 `dangerouslySetInnerHTML`。
- 赛事详情拆分为概览 / 赛题 / 赛事榜 / 公告 / 答疑独立路由，由共享布局提供赛事头部与导航；`/competitions/:id` 仅展示概览与报名。
- 题目详情拆分为题目 / Writeup / 讨论独立路由，由共享布局提供题目头部与导航；切换页面时保留 `?competition=ID`。
- 比赛进行中（live 且未归档）禁止访问题目 Writeup / 讨论：前端隐藏入口并拦截直接 URL，后端对携带 `competition_id` 的非管理员请求返回 403；管理员保留 API 读取能力用于 moderation。
- 赛事进行中从 `/competitions/:id/challenges` 进入题目时，链接必须携带 `?competition=ID`；题目页据此展示比赛模式并按赛事提交。隐藏赛事题无 `?competition` 时按 404 处理。
- `/challenges` 列表只展示普通题目目录，进入题目链接固定为 `/challenges/:id`，不自动附加赛事上下文。

## 部署

- 开发：`make up` 启动 db / redis；`make backend-dev`、`make frontend-dev` 分别热重载。
- 生产：`make up-prod`（同时构建前后端镜像并以 Caddy 反代）。
- CI：`.github/workflows/ghcr.yml` 构建并推送 `backend` / `frontend` 到 `ghcr.io/<owner>/<repo>/<image>`；PR 仅构建，不推送。
- 端口约定：
  - `8080` 前端（Caddy 反代到前端 SPA + `/api` 到后端）
  - `8081` 后端（仅容器内可见，不对外暴露）
  - `5432` Postgres（仅本地开发暴露）
  - `6379` Redis（仅本地开发暴露）

## 测试

- Go：`go test ./...`；优先表驱动测试。
- 前端：暂不引入测试框架；页面回归使用系统 Chrome + playwright-core 脚本执行（脚本不入库）。

## 路线图

- **P1 地基**：compose、配置、迁移、注册/登录/JWT、健康检查 ✅
- **P2 核心题目**：分类、题目 CRUD、static/regex flag、提交判题、附件、动态打分 ✅
- **P3 容器化题目**：docker-cli 编排、dynamic flag 注入、实例生命周期、TTL worker ✅
- **P4 社区**：公告、讨论区（嵌套 + 点赞）、Markdown 渲染、通知中心 ✅
- **P5 管理后台 + 高级**：Admin UI 完善、实时记分板、统计图表、导入导出 ✅（持续打磨）

## 当前进度

参考 `memory.md`。
