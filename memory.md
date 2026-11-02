# memory.md

项目工作记忆与状态记录。每次会话开始时先读这份文件，了解当前进展。

## 当前状态

**阶段**：P1–P5 完成；设计指南差距审计 P1/P2/P3 全部落地，P4 部分落地（计分模式/分组榜/2FA/RBAC/权限细化）；题目/赛事 `view/manage` 分级授权与 delegated 管理、社区/团队讨论区与社区权限管理已上线；社区讨论区已升级为 Luogu 风格主题列表与楼层详情；比赛模式已支持赛事/练习解题分离与重复提交不计分，赛事页标注已通过/比赛已解出/赛事题；赛事报名、独立公告、赛事答疑与取消成绩已上线；封榜已接入公开榜/管理实时榜，计分按提交时存储分数汇总；赛事详情拆分为概览/赛题/赛事榜/公告/答疑独立页面；题目详情拆分为题目/Writeup/讨论独立页面；比赛进行中禁止访问题目 Writeup/讨论（前端隐藏入口并拦截直接 URL，后端校验 `competition_id` 并返回 403，管理员 API 保留 moderation 读取）；`/challenges` 列表保持普通目录且链接不带赛事参数；隐藏赛事题按 `?competition=ID` 显式放行；GHCR 多架构镜像 workflow 已加入；社区主题支持编辑与历史版本、社区文案后台可编辑；站点设置拆为品牌 / 注册与认证 / 其他设置 / 社区文案 / 邮件群发五个可深链分页，社区文案编辑迁入「站点设置 › 社区文案」；后台表单、账号设置与团队创建/加入全面路由化；前台弹窗统一为 `Modal` + `useConfirm`，原生 `window.confirm` 已全部移除
**最后更新**：2026-11-01

后端 Phase 1–4：站点设置、审计日志、比赛窗口、邮箱验证、密码重置、提示扣分、头像、Prometheus metrics、mailer（console/smtp/off）全部上线并经端到端验证。

前端 Phase 5–6：HintsPanel、提交历史页、头像上传 + 编辑资料、邮箱验证页、忘记/重置密码页、注册邀请码字段、Admin 站点设置页、Admin 审计日志页、Admin 赛事 CRUD、所有新路由已接入 App.tsx。

前端补全轮：新增赛事列表/详情、团队详情/团队榜、Admin 内联提示管理、队长转让 UI；补齐站点设置对注册/密码重置入口的门控；修复邮箱 token 走 query 参数的兼容问题。

**2026-11-01 路由化编辑与统一弹窗**：社区主题支持编辑与版本历史（迁移 `000029_discussion_revisions`，`GET/PATCH /discussions/:id/content`、`GET /discussions/:id/revisions`，历史仅作者与版务可读，未登录 401）；`/community` 拆为共享布局下的列表 / 发帖（`/community/new`）/ 编辑（`/community/:id/edit`）/ 历史（`/community/:id/history`）四个路由，富文本统一走 `MarkdownEditor`（本地预览开关，渲染复用 `Markdown` 的 sanitize 管线）。社区名称/简介/规则等文案改为可编辑站点设置（`community.copy.*`，由 `GET /community` meta 下发），`/admin/community` 用注册表驱动编辑器，仅暴露白名单键并写入审计。后台写操作全面路由化：赛事 `/admin/competitions/new|:id/edit|:id/announcements|:id/registrations`、题目 `/admin/challenges/new|:id/edit`、用户详情 `/admin/users/:id`；账号资料/密码/2FA 迁到 `/settings`（`/settings/password`、`/settings/security`），团队创建与加入拆为 `/teams/new`、`/teams/join`。新增弹窗基元 `components/ui/Modal`（portal + `role=dialog`、`aria-labelledby`、Escape 与遮罩关闭、焦点陷阱与还原、滚动锁、`data-autofocus`）与 `ConfirmProvider`/`useConfirm()`（返回 `Promise<boolean>`，默认危险样式）；`AdminOverviewPage` 容器日志与 `AdminAccessGroupsPage` 权限组表单改用 Modal，13 个文件中的 14 处 `window.confirm` 全部替换为 `useConfirm`。浏览器回归 54/54（桌面 23、375px 7、权限组增删与容器清理/群发拦截 13、题目/分类/公告删除文案与取消 11），覆盖焦点陷阱、Escape 与遮罩不触发请求、确认后真实执行删除、Modal 底部按钮提交表单；Go vet/build/test、TypeScript 与生产构建通过；`dangerouslySetInnerHTML`、`window.confirm/alert/prompt`、外部运行时资源与组件内硬编码色值 grep 均为 0；临时测试用户与其数据（含审计记录）已清理。

**2026-11-01 站点设置分页化**：`/admin/settings` 由一页长表单改为共享 `AdminSettingsLayout` 下的五个可深链分页 —— 品牌（index）、`registration`、`misc`、`copy`、`broadcast`，每屏只 `PUT` 自己管辖的键（`changedSettings` 取与当前服务端值的差集；`SettingService.UpdateMany` 走 `UpsertMany` 只增改不删，因此部分提交安全），不再有整页「保存全部」。社区文案编辑从 `/admin/community` 迁入「站点设置 › 社区文案」，写入端点改为 `PUT /admin/settings/copy`（`settings.manage` 把关），白名单过滤下沉为 `service.SettingService.filterCommunityCopy` + `UpdateCommunityCopy`（非 `CommunityCopyKeys` 键丢弃、值 trim、留空即回落内置默认）；删除 `PUT /admin/community/copy` 与 `CommunityAccessService.UpdateCopy`，`GET /admin/community` 不再返回 `copy`，审计动作仍记 `community.copy`。`/admin/community` 只保留可见性/发帖策略/授权，并对持有 `settings.manage` 的用户显示一行跳转链接。权限完全由角色派生且只有 `admin` 同时持有 `settings.manage` 与 `community.manage`，因此文案写权换命名空间不改变实际可编辑人群。浏览器回归 49/49（五分页深链与唯一激活 Tab、品牌/注册分页 PUT 键集、文案覆盖写入后经 `GET /community` meta 生效并清空回落、其他设置空态、社区页无文案区块与跳转链接、群发弹窗 Escape/取消不触发请求、375px 无横向溢出、无 pageerror），另单测其他设置分页对真实行的 PUT 只带自身键；curl 矩阵：admin 200、moderator 403、`site.name`/`community.copy.nope` 等越界键被丢弃、旧路径 404、`competition.active_id` 仍被剥离、审计可见；Go vet/build/test（含新增 `filterCommunityCopy` 表驱动测试）与 TypeScript、生产构建通过；临时测试用户、其审计与设置行已清理，站点设置表恢复原 10 行。

**2026-11-01 比赛交互限制**：比赛进行中（live 且未归档）禁止访问题目 Writeup 与题目讨论。前端在 `ChallengeLayout` 中隐藏 Writeup/讨论导航，直接访问 `/challenges/:id/writeups|discussions?competition=ID` 显示「比赛期间不可用」；后端 Writeup list/create 与 challenge discussion list/create 校验 `competition_id`，非管理员返回 403，管理员保留 API 读取用于 moderation；赛事结束/未开始/非绑定题目仍按练习模式可用。API 回归 14/14，浏览器回归 27/27（比赛拦截、直接 URL、返回题目、练习/已结束回退、移动端无横向溢出、无页面错误），题目页面回归 25/25，赛事页面 28/28，比赛审计 20/20；Go test/vet、TypeScript 与生产构建通过；测试数据已清理。

**2026-10-31 题目页面拆分**：题目详情从单页拆为共享布局下的 3 个独立路由：题目（`/challenges/:id`）、Writeup（`/challenges/:id/writeups`）、讨论（`/challenges/:id/discussions`）。布局统一渲染返回入口、比赛模式提示、题目标题/分数/解题状态与导航，子页面按需渲染提交/实例/提示、Writeup 和讨论；切换页面保留 `?competition=ID`。浏览器回归 25/25（路由、内容隔离、直接访问、比赛参数保留、移动端无横向溢出、无页面错误），TypeScript 与生产构建通过；测试数据已清理。

**2026-10-31 赛事页面拆分**：赛事详情从单页拆为共享布局下的 5 个独立路由：概览（`/competitions/:id`，报名 + 说明）、赛题（`/competitions/:id/challenges`）、赛事榜（`/competitions/:id/scoreboard`）、公告（`/competitions/:id/announcements`）、答疑（`/competitions/:id/discussions`）。布局统一渲染赛事头部、阶段/封榜/报名徽章、时间与导航，子页面按需请求数据；旧入口链接保持指向概览。浏览器回归 28/28（路由、内容隔离、直接访问、全部子页面移动端无横向溢出、无页面错误），封榜回归 6/6，TypeScript 与生产构建通过；测试数据已清理。

**2026-10-31 比赛审计**：补齐 Luogu 风格封榜：`freeze_at` 后至结束前公开赛事榜只统计封榜前解题，管理员/赛事管理者通过 `includeFrozen` 看实时榜，结束后恢复完整榜；赛事详情/列表返回 `scoreboardFrozen`，前端展示「封榜中」与正确说明。修复计分模式不一致：`fixed` 固定基础分、`three_blood` 按第 1/2/3 解加 10%/5%/2%、`dynamic` 衰减，均在提交时写入 `competition_solves.score`；赛事榜改为汇总存储分数，不再按当前题目分值重算。新增赛事时间校验（`start < end`、`freeze_at` 在窗口内、名称/slug 必填，400）。API 审计回归 20/20，浏览器封榜回归 6/6，Go service 单元测试与全量 test/vet、TypeScript/生产构建通过；测试数据已清理。

**2026-10-31 赛事参与**：新增迁移 `000028_competition_participation`（`registration_required`、`competition_registrations`、`competition_announcements`、`discussions.competition_id` 与 competition scope）。赛事支持报名开关/报名码、报名状态与人数、取消报名（开赛后禁止）；独立赛事公告支持草稿/发布，公开端仅见已发布；赛事答疑复用讨论区 `competition` scope，未报名用户不能发帖，`discussion.moderate` 与赛事管理者免报名；管理端可按赛事取消/恢复成绩（`competition_registrations.score_excluded`），排行榜过滤被取消用户，被取消成绩用户不能提交赛事题。新增 API：`GET /competitions/:id/registration`、`POST/DELETE /competitions/:id/register`、`GET /competitions/:id/announcements`、`GET/POST /competitions/:id/discussions`，管理端报名名单/公告 CRUD/答疑 moderation。API 回归 25/25（赛事参与）+ 25/25（比赛模式）；浏览器回归 22/22（赛事参与）+ 15/15（比赛模式）+ 16/16（状态标注）+ 9/9（隐藏题）+ 6/6（列表上下文）；Go test/vet、TypeScript 检查与前端生产构建通过；测试数据已清理。

**2026-10-29 比赛模式**：新增 `competition_solves`（迁移 `000027_competition_mode`）与 `submissions.competition_id`。比赛进行中从赛事页进入题目携带 `?competition=ID` 并按赛事提交；未显式指定时按练习模式处理。赛事解题只写 `competition_solves`，不影响练习 `solves` 与用户全局分；练习解题仍写 `solves`。重复正确提交返回 `score=0`、`alreadySolved=true`，不重复计分。赛事榜优先 `competition_solves`，并 UNION 旧 `solves` 兼容历史成绩。`GET /challenges` 支持 `competition_id`，赛事详情标注「已通过」「比赛已解出」「赛事题」，赛事题链接携带 `?competition=ID`；`/challenges` 列表保持普通目录，链接不携带赛事参数。容器化题目已通过后仍可重新启动实例重做；比赛模式实例状态按 `competitionSolved` 判断，练习已通过不阻止赛事重做。隐藏题仅在携带 `competition_id` 且赛事 live、未归档、显式绑定时可见；无上下文返回 404。新增 `.github/workflows/ghcr.yml` 推送 `ghcr.io/<repo>/backend|frontend` 多架构镜像，PR 仅构建。API 回归 25/25 + 隐藏题 15/15；浏览器回归 15/15 + 状态标注 16/16 + 重做 7/7 + 隐藏题 9/9 + 列表上下文 6/6；Go test/vet、TypeScript 检查与前端生产构建通过。

**2026-10-28 社区与团队讨论**：讨论区扩展为 `challenge` / `community` / `team` scope；新增社区主题标题、社区可见范围（public/members/restricted）与发帖策略（members/restricted）、`community_access_grants`（view/manage）。新增 `/community`、`/community/:id`、团队详情内部讨论、`/admin/community` 社区权限页与 `community.manage` 权限。社区页升级为 Luogu 风格主题列表与楼层详情，支持搜索、排序、标签、分页、浏览/回复统计、置顶/锁定；通知跳转 `/community/:id`。迁移 `000025_community_discussions`、`000026_discussion_stats`。API 回归 37/37；浏览器回归 31/31（桌面 + 移动端无横向溢出）；Go test/vet、TypeScript 检查与前端生产构建通过。

**2026-10-27 分级授权**：题目与赛事授权支持 `view` / `manage`，按用户、团队、权限组授予；`manage` 隐含 `view`。被授权用户通过 `/users/me` 的 `delegations` 进入 `/admin`，仅看到被授权资源；创建/删除、导出、激活/归档、可见性/发布状态与授权列表仍限全局管理员。delegated 操作写入审计时附加 `delegated: true` 与 `grant`。迁移 `000024_scoped_access`。浏览器回归：分级授权 11/11、公共赛事 manage 2/2、移动端 delegated 3/3、桌面 31/31、移动 18/18、审计脚本 0 错误；Go test/vet 与前端生产构建通过。

**2026-10-26 稳定性与移动端**：鉴权切换为 HttpOnly cookie（access/refresh/session 标记，Bearer 兼容）；限流超限改 429/42900；无活跃实例返回 `null`；Bootstrap 仅对鉴权错误清会话；头像增加 `hasAvatar` 兜底；移动端导航、Admin 用户/实例卡片布局与赛事头部按钮修复；Inter / JetBrains Mono 改为本地自托管，移除 Google Fonts / rsms.me 外链。浏览器回归：桌面 31/31、移动 18/18。

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
- [x] **三种容器来源**（`source_type` 字段）：
  - `image` 直接 pull 第三方镜像
  - `dockerfile` 上传 Dockerfile + 上下文文件，启动时 `docker build -t ctfoj-chal-<id>:<tag>`
  - `compose` 上传 `docker-compose.yml`，启动时 `docker compose -p ctfoj-<instanceID> up -d`；compose 内用 `${PUBLISHED_PORT}` 占位对外端口
- [x] **源文件存储**：`/data/challenge_sources/challenge-<id>/`，权限 0750/0640；通过 `BACKEND_CHALLENGE_SOURCE_DIR` 可配置；compose 卷挂载到 backend / worker
- [x] **源文件管理 API**（admin）：`GET/POST/DELETE /challenges/:id/sources/*path`，支持子目录、文本编辑保存（Blob 上传）、批量上传
- [x] 动态 Flag 注入（`flag{uuid}` 通过 `FLAG` 环境变量；同时注入 `INSTANCE_ID`、`PUBLISHED_PORT`）
- [x] 端口分配（30000-40000 范围随机）
- [x] 实例表与状态机（running/stopped/expired/error），含 `compose_project` 字段记录 compose 项目名
- [x] 实例 API：start / restart / getActive / extend / stop / list mine
- [x] **Readiness 探测**：Start 完成后最多等 5s 轮询 `127.0.0.1:<port>` TCP 可达
- [x] **协议字段**：`challenges.protocol`（tcp / http），决定前端展示成 `nc host port` 或 `http://host:port`
- [x] **重启实例**：用户一键重启，旧容器销毁 + 新容器启动 + 新 flag 注入（compose 题走 `docker compose down --volumes`）
- [x] **容器日志查看**：Admin 实例总览内联日志模态（compose 题 `docker compose logs`，普通题 `docker logs`）
- [x] Worker 定时清理过期实例（默认 30s 间隔，兼容 compose 销毁）
- [x] 容器资源限制（memory / cpus；仅 image / dockerfile 模式生效，compose 模式请在 compose 文件中声明）
- [x] 同用户同题至多 1 个活跃实例（可配置）
- [x] 前端 `AdminChallengesPage`：源类型下拉；dockerfile/compose 时显示 `SourceFileManager`（模板初始化 / 文本编辑 / 多文件上传 / 子目录路径）
- [x] 前端 `DynamicInstancePanel`：HTTP/TCP 自适应展示 / TTL 倒计时（1s 精度）/ 重启 / 销毁 / 延长

### P4 社区模块
- [x] 公告系统：`announcements` 表，admin CRUD，置顶字段，发布时间
  - API：`GET /announcements`、`GET /announcements/:id`、`POST/PUT/DELETE`（admin）
  - 前端：`/announcements` 列表页、`/announcements/:id` 详情页（Markdown 渲染）
  - 首页置顶公告条 + 最新 3 条
  - Admin 后台：`/admin/announcements` 管理（编辑器 + 列表）
- [x] 讨论区：`discussions` + `discussion_likes` 表，单层嵌套回复
  - scope：`challenge`（题目）、`community`（社区）、`team`（团队内部）、`competition`（赛事答疑）
  - API：`GET/POST /challenges/:id/discussions`、`GET/POST /community/discussions`、`GET/PATCH /community/discussions/:id`、`GET/POST /teams/:id/discussions`、`GET/POST /competitions/:id/discussions`、`POST /discussions/:id/like`、`DELETE /discussions/:id`
  - 前端：题目/团队详情复用 `DiscussionPanel`；`/community` 为主题列表，`/community/:id` 为楼层详情（搜索/排序/标签/分页/浏览回复统计/置顶锁定）
  - 统计：`view_count`、`reply_count`、`last_reply_at`；详情自增浏览数，回复维护最后回复时间
  - Markdown 渲染，支持 GFM（表格/列表/代码块）
- [x] 社区权限：`community_access_grants`，支持用户/团队/权限组 `view` / `manage`；`discussion.moderate` 覆盖社区/题目 moderation
  - 可见范围 `public | members | restricted`；发帖策略 `members | restricted`
  - API：`GET /community`、`GET /admin/community`、`PUT /admin/community`、`GET/PUT /admin/community/access`
  - 前端：`/community` 讨论页、`/admin/community` 权限与策略管理
  - 团队讨论仅成员可读写，队长可置顶/锁定/删除
- [x] Markdown 渲染：`react-markdown` + `remark-gfm` + `rehype-sanitize`
  - 服务端只存原文 `content_md`，前端渲染避免存储型 XSS
  - 题目描述、公告、讨论均使用 Markdown
- [x] 通知系统：`notifications` 表
  - 触发场景：解题（含首杀标记）、回复评论
  - API：`GET /notifications/me`、`GET /notifications/me/unread_count`、`PATCH /notifications/:id/read`、`POST /notifications/read_all`
  - 前端：顶部导航通知铃铛（30s 轮询未读数，下拉显示最新 5 条）、`/notifications` 通知中心（分类筛选 + 单条/全部已读）

### P5 管理后台 + 高级
- [x] 实时记分板（WebSocket）
  - 后端：`infrastructure/realtime/hub.go`（gorilla/websocket）；`/api/v1/realtime` 升级端点
  - `service.HubPublisher` 适配 `EventPublisher` 接口；解题时广播 `solve` 事件
  - 前端：`/scoreboard/realtime`，顶部连接状态指示，LIVE 解题事件流（最近 20 条）
- [x] 统计图表：`/stats` 页面（概览卡片、按分类分布、解题趋势折线、最近解题）
  - 后端：`GET /stats/overview|category|trend|recent`
- [x] 团队系统：`teams` + `team_members` 表，邀请码加入，团队榜（视图实时计算），转移所有权
  - API：`GET/POST /teams`、`POST /teams/join|leave`、`GET /teams/me|scoreboard|:id`、`DELETE /teams/:id`、`POST /teams/:id/transfer`
  - 前端：`/teams` 创建/加入/退出/解散、成员管理
- [x] 数据导入导出（题目 JSON）
  - 后端：`GET /admin/export/challenges`、`POST /admin/import/challenges`
  - 前端：`/admin/overview` 一键导出/导入（FormData）
- [x] Admin 用户管理：`/admin/users` 列表 / 封禁 / 设管理员
- [x] Admin 社区权限：`/admin/community` 可见范围、发帖策略与社区授权管理
- [x] Admin 题目管理增强：
  - **编辑回填**：列表项「编辑」按钮 → 加载 `GET /challenges/:id?scope=admin`（返回带 flag 原文）→ 回填表单 → PUT 更新
  - **附件管理**：编辑模式内嵌 `AttachmentManager` 组件（列表 / 上传 / 删除 / 下载链接）
  - 后端新增 `service.ChallengeService.GetForAdmin` 与 `AdminFlag` DTO（仅 admin 编辑时暴露 flag 原文）
- [x] Admin 实例总览：`/admin/overview` 按状态筛选 / 强制销毁运行中实例

### 六大特性包（2026-10-19）

#### 后端 Phase 1–4
- [x] **站点设置（site_settings）**：键值表 + 服务层读缓存；`PublicView` 仅暴露安全字段
  - 关键 key：`site.name`、`site.tagline`、`site.rules_md`、`site.registration_open`、`site.registration_code`、`auth.email_verification_required`、`auth.password_reset_enabled`、`competition.active_id`、`community.visibility`、`community.posting`
  - API：`GET /settings`、`GET /admin/settings`、`PUT /admin/settings`
- [x] **审计日志（audit_logs）**：fire-and-forget，由 service 层主动调用；记 actor / action / target / payload / ip
  - API：`GET /admin/audit`（支持 action / targetType 过滤 + 分页）
- [x] **赛事（competitions）**：单一激活；freeze 时间戳；slug URL
  - API：`GET /competition`（激活赛事）、`GET /competitions`、`GET/POST/PUT/DELETE /admin/competitions`
- [x] **用户扩展**：头像存储（本地存储 key 不暴露）、`email_verified_at`、`verification_tokens`、`password_reset_tokens`
  - 注册时可携带 `registrationCode`（与 `site.registration_code` 匹配）
  - 注册 / 登录返回用户对象更新；`PATCH /users/me` 更新资料；`POST /users/me/avatar` 上传头像
- [x] **邮箱验证 + 密码重置**：基于一次性 token（默认 1 小时有效）
  - API：`POST /auth/verify-email`、`POST /auth/resend-verification`、`POST /auth/forgot-password`、`POST /auth/reset-password`
  - Mailer：`infrastructure/mailer/mailer.go` 支持 `console`（stderr 日志）/ `smtp`（gomail）/ `off`；默认 console
- [x] **提示扣分（challenge_hints + hint_unlocks）**：CTFd-style `cost_ratio`（0.0–1.0）
  - 解题得分 = `round(raw * (1 - sum(unlocked cost_ratios)))`
  - API：`GET /challenges/:id/hints`、`POST /challenges/:id/hints/:hintId/unlock`、Admin 增删改 hints
- [x] **Prometheus metrics**：`/metrics` 端点（Caddy 反代）
  - 计数器：submissions、solves、instances、registrations、logins
- [x] **Makefile 扩展**：`backup`（pg_dump -Fc）、`restore`、`migrate-all`
- [x] 迁移：`000009_operational_infrastructure`、`000010_user_extensions`、`000011_hints`

#### 前端 Phase 5–6
- [x] `HintsPanel`：题目详情页解锁提示，UI 显示扣分百分比
- [x] 提交历史页 `/me/submissions`：终端 log 风格，正确/错误图标
- [x] 个人主页：头像上传、个人简介编辑、邮箱未验证提示、解题/提交双 tab
- [x] 邮箱验证页 `/auth/verify-email/:token`：链接直达，一键验证
- [x] 忘记密码 `/auth/forgot-password`、重置密码 `/auth/reset-password/:token`：两步流程
- [x] 注册页：站点开启邀请码时显示 `registrationCode` 字段
- [x] 登录页：忘记密码链接
- [x] Admin 站点设置页 `/admin/settings`：分组（品牌 / 注册认证 / 其他键值）+ 自定义 toggle
- [x] Admin 审计日志页 `/admin/audit`：终端 log 风格 + 过滤器 + 分页
- [x] Admin 赛事页 `/admin/competitions`：列表 + 模态创建/编辑 + 单一激活切换
- [x] Admin 标签栏新增「赛事 / 站点 / 审计」
- [x] App.tsx 所有新路由接入；站点设置存储于 `stores/site.ts`，更改后由 admin 页触发 `reloadSite()`

#### 前端补全（后端已有能力 → 前端补齐）
- [x] 赛事：`/competitions` 列表（活跃赛事摘要 + 阶段推导）；`/competitions/:id` 概览 + `/challenges`、`/scoreboard`、`/announcements`、`/discussions` 独立页面（2026-10-31）
- [x] 团队：`/teams/:id` 详情（成员、队长标识、团队得分）、`/teams/scoreboard` 团队榜
- [x] 队长转让：`POST /teams/:id/transfer` + 队长专属「转让队长」按钮（Crown 图标）
- [x] Admin 题目编辑页内联 `HintManager`（成本百分比 / Markdown 内容 / 增删改）
- [x] 题目导出改用鉴权 Axios 客户端 + blob（修复原 `fetch` 无 Bearer 导致 401）
- [x] 站点规则 `site.rules_md` 在首页渲染；导航新增「赛事」
- [x] 站点设置门控：关闭注册时隐藏注册入口 / 注册页显示关闭提示；关闭密码重置时隐藏「忘记密码」入口与页面
- [x] 邮箱验证 / 重置密码页同时支持路径参数与 `?token=`（后端邮件链接实际使用 query）
- [x] `/auth/reset-password` 移除 `PublicOnly`，已登录用户可直接使用邮件链接

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
- [x] 题目详情（描述 Markdown、附件、提交 Flag、动态实例面板）+ Writeup / 讨论独立页面（2026-10-31）；比赛进行中隐藏并拦截 Writeup / 讨论（2026-11-01）
- [x] 我的实例页面、榜单页、个人主页
- [x] 公告列表 + 详情、通知中心
- [x] 404 页面
- [x] 管理后台（分类 CRUD + 题目创建/编辑/删除 + 附件管理 + 公告管理 + 用户管理 + 实例总览 + 导入导出）
- [x] 社区主题编辑与版本历史、发帖/编辑/历史独立路由、`MarkdownEditor` 本地预览、社区文案后台可编辑（2026-11-01）
- [x] 后台写操作路由化：赛事表单/公告/报名、题目表单、用户详情；账号 `/settings`；团队 `/teams/new`、`/teams/join`（2026-11-01）
- [x] 站点设置分页化：`/admin/settings` 品牌 / `registration` / `misc` / `copy` / `broadcast` 五个可深链分页，每屏只写自己的键；社区文案编辑迁入并改由 `PUT /admin/settings/copy` 写入（2026-11-01）
- [x] 统一弹窗基元 `Modal` + `useConfirm`（焦点陷阱、Escape/遮罩、滚动锁、焦点还原），全站移除 `window.confirm`（2026-11-01）

### 部署与运维
- [x] 多阶段 Dockerfile（backend & worker 共用 alpine + docker-cli）
- [x] Caddy 反代 `/api` → backend、其余 → frontend
- [x] 完整 `make up` / `make up-prod` / `make migrate` 工作流
- [x] backend / worker 容器挂载 `/var/run/docker.sock`
- [x] 一键部署 `scripts/deploy.sh`（`make deploy`）：生成 `.env`/密钥、等待依赖、迁移、构建、健康检查
- [x] 迁移追踪 `scripts/migrate.sh` + `schema_migrations`（`make migrate` 只执行未应用项；旧库可 `--baseline-existing`）
- [x] 端到端联调验证通过

## 设计指南差距审计（2026-10-23）

对照《CTFOJ 设计指南》逐模块审计结论。✅ 已实现 · ◐ 部分 · ✗ 缺失 · S/M/L 为工作量。

### 题目与练习
- ✅ 类型前置两套表单（静态/容器单选卡片 + 条件分区）（2026-10-24）
- ✅ 多 flag、regex、大小写、附件、hint、动态评分
- ◐ 动态 flag：固定 `flag{uuid}` + `FLAG` 环境变量；缺 flag 模板 / 注入通道 / 消费逻辑约定（M）
- ✅ 容器三来源（image/dockerfile/compose）、TTL、CPU/内存限制、readiness
- ✅ 连接信息：模板 `${host}` / `${port}`，实例 API 返回渲染后的 `connection`（2026-10-24）
- ◐ 资源限制：已加 pids；CPU 仍为整数；compose 模式不生效（S/M）
- ◐ 健康检查：硬编码 TCP 10×500ms，不可配置（M）
- ✅ 状态机 draft/hidden/published/archived（定时发布仍缺）（2026-10-24）
- ✅ 未发布题按 ID 直读与附件下载守卫（2026-10-24）
- ✗ 题解 Editorial（S）
- ✅ 筛选：后端 q/difficulty/type/solved + 分类分页；前端服务端筛选（2026-10-24）
- ◐ 导出已补 status/editorial/pids；仍漏 protocol/source_type/build_context/hints/源文件/附件内容（M）

### 比赛系统
- ✅ CRUD、单激活、时间窗、阶段推导、倒计时
- ✅ 可见范围 public/private；报名开关/报名码已上线，审批仍缺（2026-10-31）
- ✅ 比赛-题目绑定（`competition_challenges`）；赛中启停编排仍缺（2026-10-24）
- ✅ 赛事报名、独立公告、赛事答疑、取消/恢复成绩（迁移 000028）（2026-10-31）
- ✅ 比赛模式：赛事/练习解题分离（`competition_solves` + `submissions.competition_id`，迁移 000027）（2026-10-29）
- ✅ 赛事页进入题目携带 `?competition=ID`；无参数按练习模式；隐藏题仅在有 live 赛事上下文时可见；重复正确提交 0 分（2026-10-29）
- ✅ 计分模式 dynamic/fixed/three_blood（前三解加成 10%/5%/2%）（2026-10-24）
- ✅ 比赛榜（个人 + 团队 `group=team`）；赛事榜含旧 `solves` 兼容回退（2026-10-29）
- ✅ 封榜：公开榜按 `freeze_at` 截止，管理员实时榜，结束后恢复完整榜（2026-10-31）
- ✗ 赛中启停题目 / 实例策略覆盖（M）
- ◐ 赛后归档 + CSV 成绩导出；回流练习仍缺（2026-10-24）
- ✅ 队伍计分（赛事团队榜按成员聚合）（2026-10-24）

### 排行榜与统计
- ✅ 全局榜、团队榜（已修为实时汇总）、实时 WS 榜
- ✅ 首解 `/stats/first-bloods`、前三解 `/challenges/:id/podium`（2026-10-24）
- ✗ 前三解 / 三血（M）
- ✅ 提交趋势 `/stats/submissions/trend`（2026-10-24）
- ◐ 题目维度统计仅 solveCount（S/M）
- ◐ `/metrics` 存在但实例/注册/登录计数器未自增；无按题运行指标聚合（S/M）

### 用户与队伍
- ✅ 注册/登录/邮箱验证/密码重置/头像/简介/解题与提交历史
- ✅ 修改密码（校验旧密码）（2026-10-24）
- ✅ 管理员重置密码（强制下线仍缺）（2026-10-24）
- ✅ 2FA（TOTP：setup/enable/disable + 登录 `totpCode`，错误码 40101）（2026-10-24）
- ✅ 公开用户 DTO：`GET /users/:id` 不再泄露 email/封禁信息；资料可见性已补（2026-10-24）
- ✅ 派生式成就（6 项，无需额外表）（2026-10-24）
- ✅ 关注 / 动态流（`user_follows`、关注按钮、首页 Feed）（2026-10-24）
- ✅ 队伍创建/加入/退出/移除/转让
- ✅ 邀请码刷新 + 仅 owner/admin 可见（2026-10-24）
- ✗ 队内角色（M）
- ✅ 队伍实例归属/共享（`instances.team_id`，同队复用与停止）（2026-10-24）

### 管理后台
- ✅ 分类/题目/实例/公告/审计/设置
- ✅ 用户列表搜索/角色/封禁/榜单排除筛选（2026-10-24）
- ✅ 封禁生效：登录/刷新校验 + 全局 `RequireActive`（2026-10-24）
- ✅ 取消资格 / 榜单隐藏：`users.score_excluded` + 管理端开关（2026-10-24）
- ✅ 角色分级（`challenge_admin` / `competition_admin` + 路由/前端守卫）（2026-10-24）
- ◐ 站点设置 8 键；缺首页内容、端口策略、全局实例默认值（M）
- ✅ 邮件群发（`POST /admin/broadcast` + 设置页）（2026-10-24）
- ✅ 容器实例概览 + 日志；缺资源占用/健康失败统计

### 社区
- ✅ 公告、通知中心（30s 轮询）、题目讨论（一层嵌套 + 点赞）
- ◐ 讨论已支持置顶/锁定/标签；分类与赛中限制仍缺（2026-10-24）
- ✗ 官方题解（S/M）
- ✅ Writeup 发布/可见性（解题后可见）/作者与管理员管理；审核/导出仍缺（2026-10-24）
- ✗ 比赛内通知（scope）（S/M）
- ✗ 赛后复盘页（M）
- ✅ 通知 WS：按用户定向推送 `notification` 事件（2026-10-24）

### 前端
- ✅ Writeup / 热力图 / 成就 / 关注 / 动态流 / 2FA 已补；全局搜索仍缺
- ✗ Markdown 无 Prism 代码高亮与 KaTeX
- ✅ 题目列表难度/类型/已解/关键词服务端筛选
- ✅ 个人主页活动热力图 + 成就；参赛记录仍缺
- ✅ 已补齐：团队榜/详情、赛事列表/详情、Admin 内联 hint、队长转让
- ✅ 未发现“有 UI 无 API”的幻觉页面

### 实施进度（2026-10-24）
P1/P2/P3 全部完成。P4 已落地：计分模式（dynamic/fixed/three_blood）、赛事团队榜、2FA（TOTP）、RBAC（challenge_admin/competition_admin/moderator）、权限点细化、全局搜索、团队实例共享（`instances.team_id`，同队复用/可停止，列表含队友实例）。P4 未做：比赛中题目启停编排、赛后复盘/回流练习页、通知偏好与邮件通知。

### 部署 / 权限 / 服务器管理（2026-10-25）
- [x] `scripts/deploy.sh`：首次生成 `.env` 与随机密钥；已有库不会自动轮换数据库密码；启动依赖 → 迁移 → 构建 → 健康检查；输出管理员提升命令
- [x] `scripts/migrate.sh`：`schema_migrations` 逐条事务应用；已有库无追踪时需确认或 `--baseline-existing`
- [x] 权限点：`domain.Permission` + 角色映射；`middleware.RequirePermission`；`/users/me` 与登录返回 `permissions`
- [x] 新增 `moderator` 角色：公告管理 + 讨论区版主，不能访问用户/站点/服务器
- [x] 前端按权限控制路由、后台标签、管理入口、讨论区版主操作
- [x] Admin 服务器页 `/admin/server`：主机/内存/磁盘/运行时/依赖/数据量/托管容器；`POST /admin/server/prune` 清理停止容器（`server.manage`）

### 隐藏题目与访问授权（2026-10-25）
- [x] `challenge_groups` / `challenge_group_members` / `challenge_access_grants`（迁移 000023）
- [x] `hidden` 题目仅对直接授权的用户、团队，或授权权限组内的用户/团队可见
- [x] 列表、详情、提交、附件、提示、讨论、Writeup、容器实例、赛事绑定题目均走统一 `ChallengeAccessService`
- [x] Admin 题目表单增加访问授权编辑器；`/admin/access-groups` 管理权限组（成员支持用户 + 团队）
- [x] 赛事管理页：题目搜索/筛选、状态徽章、已选数量与隐藏题数量；可展开查看已绑定题目
- [x] 赛事详情页展示赛题列表（分类/分值/难度）；未绑定题目时展示全部公开题目；`boundChallengeCount` 区分「未绑定」与「已绑定但不可见」
- [x] API：`/admin/access/groups`、`/admin/access/subjects`、`/challenges/:id/access`

### 题目/赛事分级授权（2026-10-27）
- [x] `challenge_access_grants.permission` 与 `competition_access_grants`（迁移 000024），授权主体支持用户 / 团队 / 权限组
- [x] 授权级别：`view`（隐藏题目、私有赛事可见）与 `manage`（隐含 `view`，可编辑元数据、附件、提示、容器源）
- [x] 公共赛事同样支持显式 `manage`：公开可见性不会被误判为只读，授权管理仍以显式 grant 为准
- [x] 被授权者可通过 `delegations` 进入 `/admin`；后台 tabs、列表与编辑页仅展示授权范围
- [x] delegated 编辑限制：不可删除/创建、导出成绩、激活/归档、修改可见性/发布状态或授权列表
- [x] 审计记录 delegated 操作：payload 追加 `delegated: true` 与 `grant`（如 `challenge:12:manage`）；审计页显示「授权操作」标记
- [x] API：`/challenges/:id/access`、`/admin/competitions/:id/access` 支持 `permission`；`/users/me` 与登录返回 `delegations`
- [x] 前端：`AccessGrantEditor` / 权限选择、Admin 赛事模态授权编辑、delegated 守卫与后台入口
- [x] 已验证：view 用户可见隐藏题/私有赛事但无法进入后台；manage 用户可编辑且受保护字段不变；权限组授权生效；审计标记正确

### 管理后台审计与 UX（2026-10-26）
- [x] 角色/封禁状态实时生效：`RequireActive` 每请求回读数据库并刷新角色；`OptionalActive` 覆盖匿名可选鉴权路由，降权/封禁后旧 token 不再保留管理权限；前端收到 40310 自动清理会话
- [x] 公告草稿：新增 `GET /admin/announcements`，后台列表可见并编辑未发布公告；公告详情允许 `announcement.manage` 预览草稿
- [x] 审计补全：用户角色/封禁/榜单排除/重置密码、题目/分类/公告/赛事 CRUD、权限组、题目授权、实例销毁、邮件群发、容器清理
- [x] 用户/题目/实例后台列表增加分页；题目支持标题/标签搜索与状态筛选
- [x] 关键操作确认与失败反馈：封禁/解封、角色变更、重置密码、榜单排除、销毁实例、删除题目/分类/赛事、导出成绩
- [x] 赛事编辑保留 `registrationCode`（仅 admin scope 返回），避免保存时误清空
- [x] 分类删除遇到外键冲突返回 409 而非 500；站点设置增加未保存更改提示与保存禁用
- [x] 修复分类空状态死按钮、题目删除仅 console 报错、实例日志弹窗 blur 等问题

### Cookie 会话存储（2026-10-26）
- [x] 登录/注册/刷新不再向前端返回 token，改为服务端写入 HttpOnly cookie：`ctf_oj_access`（Path `/api/v1`）、`ctf_oj_refresh`（Path `/api/v1/auth`）、`ctf_oj_session`（非 HttpOnly 会话提示）
- [x] Cookie 使用 `SameSite=Lax`；HTTPS/`X-Forwarded-Proto=https` 时自动加 `Secure`
- [x] 新增 `POST /api/v1/auth/logout` 清除全部会话 cookie；封禁/删除用户时中间件同步清除
- [x] 鉴权中间件优先读 `Authorization: Bearer`，无 header 时回退 access cookie；WebSocket 复用同一 cookie
- [x] 前端移除 localStorage token 与请求头注入，Axios 统一 `withCredentials: true`，刷新仅依赖 refresh cookie；启动时清理旧版 `ctf-oj.tokens`
- [x] 启动引导通过 `ctf_oj_session` 判断是否需要探测 `/users/me`，匿名访问不再触发多余刷新
- [x] 已验证：登录响应不含 tokens、cookie-only `/users/me` 200、refresh 轮换、logout 后 401、封禁返回 40310 并清 cookie

### 迁移记录（2026-10-27）
已按序应用至 `000024_scoped_access`：000019 follows、000020 two_factor、000021 scoring_mode、000022 instance_team、000023 challenge_access、000024 scoped_access。逐条执行，未使用 `make migrate-all`。

### 实施计划
1. **P1 安全/正确性**：未发布题守卫、封禁生效、邀请码保密、公开用户 DTO、freeze 接入、metrics 自增。
2. **P2 小增量**：修改密码、管理员重置、用户搜索、邀请码刷新、editorial、题目筛选、首解/前三解、提交趋势、讨论置顶/锁定/标签、pids、连接模板、导出补全、通知 WS、状态机、DQ。
3. **P3 中型**：类型前置两套表单、Writeup、比赛可见性 + 题目绑定 + 比赛榜 + 归档、主页成就/热力图/关注、邮件群发、资料可见性。
4. **P4 大型**：计分模式、队伍/分组榜、2FA、徽章、RBAC、团队实例。

### 2026-10-26 稳定性与移动端
- [x] Cookie 会话：`ctf_oj_access` / `ctf_oj_refresh` HttpOnly，`ctf_oj_session` 仅作前端会话提示；登录/注册/刷新不再返回 token；新增 logout；封禁/删除用户清 cookie。
- [x] 限流超限返回 HTTP 429 + `code 42900`（默认 600/min），修复浏览器端误报 500。
- [x] `GET /challenges/:id/instance` 无活跃实例返回 200 + `null`，前端类型同步。
- [x] `useBootstrapAuth` 仅对 `40100`/`40310` 清会话，避免临时 500 或导航中断导致误登出。
- [x] 头像 `hasAvatar` 贯通后端 DTO 与前端；资料页无头像时使用 Avatar 兜底，消除 404。
- [x] 移动端导航：汉堡菜单 + 路由切换自动关闭；Admin 标签 `whitespace-nowrap`；Admin 用户/实例列表在窄屏改为卡片，角色与操作可见；赛事页「新建赛事」按钮不再竖排。
- [x] 浏览器回归覆盖公开页、登录/刷新/登出、封禁、赛事题目、后台页面、移动端溢出、导航与卡片操作。
- [x] 字体本地化：`frontend/public/fonts/` 自托管 Inter / JetBrains Mono（含 OFL 许可），`index.html` 移除外部 preconnect 与字体样式表；Playwright 验证运行时外部请求为 0。

## 未实现 / 待办

- [x] 团队系统：邀请码刷新
- [x] WebSocket 通知（`/api/v1/realtime?token=...`，按用户推送）
- [ ] 容器网络隔离（专用 bridge）
- [ ] S3 / MinIO 附件后端
- [ ] OAuth（GitHub）登录
- [ ] 前端测试框架引入
- [ ] **Phase 7（前端渲染增强，进行中）**：
  - Prism 代码高亮 + KaTeX 数学公式集成到 `Markdown.tsx`
  - 个人主页活动热力图
  - 全局搜索框（题目 / 用户 / 公告）

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
- **2026-10-18**：实时记分板走 WebSocket（`/api/v1/realtime`），Hub 通过 select + RLock 扇出，慢消费者自动断开。
- **2026-10-18**：`domain.Flag.Content` 默认 `json:"-"` 隐藏 flag 原文；admin 编辑回填通过 service 层 `AdminFlag` DTO 单独暴露，避免污染其他序列化路径。
- **2026-10-18**：容器题目区分协议（tcp/http），存于 `challenges.protocol`，决定前端展示形态；后端 `service.normalizeProtocol` 兜底默认 tcp。
- **2026-10-18**：实例启动后做 TCP readiness 探测（10 次 × 500ms = 5s 上限），避免向用户返回 running 但容器未通的端口；探测失败仍记 running（不阻塞 API）。
- **2026-10-18**：重启实例 = 销毁旧容器 + 启动新容器 + 重新生成 flag；用户路径与 admin 强制销毁共用 `service.terminate`。
- **2026-10-18**：Admin 容器日志通过 `docker logs --tail 500 --timestamps` 走 CLI（避免流式连接复杂度），前端模态展示。
- **2026-10-18**：容器题目三种来源（image / dockerfile / compose）；源文件存 `/data/challenge_sources/challenge-<id>/`（权限 0750/0640，仅 backend / worker 容器可见）。compose 用 `${PUBLISHED_PORT}` 与 `${FLAG}` 占位符，由后端注入运行时值。
- **2026-10-18**：compose 模式约定：必须有名为 `app` 的服务暴露 `internalPort`（可通过 `buildContext` 字段配置服务名）；实例记录 `compose_project` 字段以便重启/销毁。
- **2026-10-19**：站点设置键采用点号命名空间（`site.*` / `auth.*` / `competition.*`）；admin 编辑页只暴露非保留键作为「其他设置」。
- **2026-10-19**：审计采用 fire-and-forget（service 层直接调用 `AuditService.Log`），不阻塞主流程；payload 序列化为 JSON 字符串便于查询。
- **2026-10-19**：赛事单一激活 —— 创建 / 更新时 `isActive=true` 会自动把其他赛事置为 `isActive=false`，并写入 `competition.active_id`。
- **2026-10-19**：提示扣分采用 CTFd-style 累乘 —— 解题时由 `ChallengeService.computeScore(userID)` 按 `1 - sum(costRatio)` 折扣最终分。
- **2026-10-19**：邮箱验证 / 密码重置均基于一次性 token（默认 1 小时有效）；mailer 默认 console（stderr 输出含完整链接），生产配置 SMTP 即可。
- **2026-10-19**：前端新路由 —— `/auth/forgot-password`、`/auth/reset-password/:token`、`/auth/verify-email/:token`、`/me/submissions`、`/admin/competitions`、`/admin/settings`、`/admin/audit`。
- **2026-10-23**：提示更新改为按列 `Updates`（原 `Save` 会用零值覆盖 `challenge_id`/`created_at`，触发外键 500）；更新后回读整行再返回。
- **2026-10-23**：团队榜改为实时汇总成员解题分后排序分页（原 `ListScoreboard` 读持久化 `score` 列，而该列只在无人调用的 `RefreshAllScores` 中刷新，导致榜单恒为 0）。
- **2026-10-23**：团队转让失败路径返回 `domain.ErrForbidden` / `ErrInvalidArgument`，避免统一映射成 500。
- **2026-10-27**：题目/赛事授权分为 `view` / `manage`，`manage` 隐含 `view`；delegated 管理仅允许编辑，不授予删除/创建/导出/激活/可见性与授权管理能力。
- **2026-10-27**：delegated 操作复用全局审计，payload 追加 `delegated: true` 与 `grant`；被授权者通过 `/users/me` 的 `delegations` 获得后台入口。
- **2026-10-29**：比赛解题独立存 `competition_solves`，不复用练习 `solves`；重复正确提交记录 submission 但返回 0 分。未显式指定赛事时按练习模式；隐藏题仅在有 live 赛事上下文时可见；赛事榜 UNION 旧 `solves` 兼容历史成绩。
- **2026-10-31**：赛事榜以 `competition_solves.score`（及旧 `solves.score`）汇总，不在读取时按当前题目分值重算；封榜只影响公开榜，管理员/赛事管理者始终可看实时榜。
- **2026-11-01**：主题编辑在事务内先 `SELECT ... FOR UPDATE` 快照旧内容再按列 `Updates`，版本号取 `edit_count + 1`，避免并发编辑撞 `(discussion_id, revision)` 唯一索引；未提交的字段保持原值，空白标题/正文按 400 拒绝而非清空内容。
- **2026-11-01**：社区文案不建新表，复用站点设置的 `community.copy.*` 前缀并由后端白名单校验；`/admin/community` 按前端注册表渲染可编辑项，仅暴露白名单键，保存写 `community.copy` 审计。
- **2026-11-01**：后台写操作（赛事/题目/用户/团队/账号设置）从页内弹窗迁到独立路由 —— URL 可分享、可后退、刷新不丢表单；只有只读详情（容器日志）和小型录入表单（权限组）保留 `Modal`。
- **2026-11-01**：二次确认统一为 `ConfirmProvider` 暴露的 `useConfirm(): Promise<boolean>`，原生 `window.confirm` 无法定制文案、不跟随主题且阻塞事件循环，全部移除；`Modal` 把 `onClose` 存入 ref，避免父组件重渲染时重新挂载焦点还原而抢走焦点。
- **2026-11-01**：社区文案本质是 `site_settings` 的一个命名空间，因此编辑入口与写端点都并入站点设置（`PUT /admin/settings/copy`，`settings.manage`），`/admin/community` 回到只管策略与授权；白名单过滤留在 service 层并复用原 `community.copy` 审计动作，历史审计筛选不断档。角色是唯一权限来源且只有 `admin` 同时持有两个权限，所以这次改守卫不影响任何人的实际能力。
- **2026-11-01**：站点设置分页只 `PUT` 与当前服务端值不同的自身键 —— 依赖 `UpsertMany` 只增改不删的语义；若沿用整页提交，一个分页的陈旧行就可能覆盖另一个分页刚写的值。

## 已知问题

- 暂无（如发现请在此记录）

## 开发常用命令

```bash
make up              # 启动依赖（postgres、redis）
make up-prod         # 构建并启动全部服务
make backend-dev     # 后端热重载
make frontend-dev    # 前端开发服务器
make migrate         # 应用 SQL 迁移
make logs / make down / make clean / make fmt / make vet / make test
```

应用迁移：

```bash
./scripts/migrate.sh              # 只应用未记录在 schema_migrations 的文件
./scripts/migrate.sh --baseline-existing  # 已有库首次接入追踪
make deploy                       # 一键部署
```

## 待用户决策

- 附件存储是否需要 S3 / MinIO 后端（当前本地存储）
- 容器题目是否使用专用网络隔离（当前用默认 bridge）
- 是否引入 WebSocket 替代通知轮询（实时记分板已先行使用 WS）
- SMTP 配置（生产启用邮箱验证 / 密码重置前必须配置 `BACKEND_MAILER_DRIVER=smtp` 与 SMTP 连接参数）
- 是否需要团队邀请码刷新
