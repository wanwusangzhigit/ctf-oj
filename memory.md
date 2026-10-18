# memory.md

项目工作记忆与状态记录。每次会话开始时先读这份文件，了解当前进展。

## 当前状态

**阶段**：P1 + P2 + P3 容器化题目 已完成并通过端到端验证
**最后更新**：2026-10-17

## 已完成功能

### P1 地基
- [x] `docker-compose.yml`（postgres、redis、backend、worker、frontend、caddy）
- [x] 配置加载（基于环境变量 + `.env`）
- [x] 结构化日志（zap，控制台格式）
- [x] GORM + PostgreSQL 连接池（含 ping 探活）
- [x] Redis 客户端（含 ping 探活）
- [x] 数据库迁移脚本（`backend/scripts/migrate.sh` + 时间戳命名的纯 SQL）
- [x] JWT 鉴权（access + refresh）
- [x] 注册 / 登录 / 刷新令牌 / 当前用户接口
- [x] 中间件：auth、optionalAuth、CORS、按 IP 限流（Redis）、日志、错误恢复

### P2 核心题目
- [x] 领域模型：User、Category、Challenge、Flag、Attachment、Submission、Solve
- [x] 仓储实现（基于 GORM，统一错误映射）
- [x] 分类 CRUD（管理员）：`POST/PUT/DELETE /api/v1/categories`
- [x] 题目 CRUD（管理员）：`POST/PUT/DELETE /api/v1/challenges`
- [x] 题目列表 / 详情（普通用户：自动过滤未发布）
- [x] Flag 提交与判题：static / regex 两类，含大小写敏感选项
- [x] 动态打分（CTFd 衰减公式：`score = (base-min)·e^(-solves/decay) + min`）
- [x] 附件上传与下载（本地存储）
- [x] 解题记录、首次解题 First Blood 字段
- [x] 解题榜接口（按 score 倒序）
- [x] 提交频率限制（每用户 10s 内最多 5 次）

### P3 容器化题目
- [x] Docker 编排器（`infrastructure/docker`，通过 docker CLI 调用 socket）
- [x] 动态 Flag 生成（`flag{uuid-v4}` 格式，通过环境变量 `FLAG` 注入容器）
- [x] 端口分配（端口范围内随机 + 探活）
- [x] 实例表与仓储（含状态机：running/stopped/expired/error）
- [x] 实例 API：`POST /challenges/:id/instance`、`GET /challenges/:id/instance`、
      `POST /challenges/:id/instance/:instanceId/extend`、
      `DELETE /challenges/:id/instance/:instanceId`、`GET /instances/me`
- [x] 题目 SubmitFlag 增加 dynamic 分支：比对实例的 dynamic_flag
- [x] 题目表扩展：`is_dynamic / image / internal_port / default_ttl / memory_limit_mb / cpu_limit`
- [x] Worker 服务：定时扫描过期实例（默认 30s 间隔），调用编排器销毁容器
- [x] 容器限制：内存上限、CPU 核心数上限、自动重启策略 no
- [x] 同用户同题至多 1 个活跃实例（可配置 `BACKEND_INSTANCE_MAX_PER_USER`）
- [x] 公网地址可配置（`BACKEND_INSTANCE_PUBLIC_HOST`）

### 前端（HydroOJ 现代简洁风）
- [x] Vite + React + TS + Tailwind 骨架
- [x] 设计令牌（中性灰 + 靛蓝强调色，亮/暗双主题跟随系统）
- [x] 基础 UI 组件：Button、Input、Textarea、Field、Card、Badge、Spinner、Toast
- [x] 路由 + 鉴权守卫（RequireAuth、RequireAdmin、PublicOnly）
- [x] Axios 拦截器 + 自动刷新 token + TanStack Query + Zustand auth store
- [x] 登录 / 注册页面（左侧介绍 + 右侧表单的简洁布局）
- [x] 主布局（顶部导航 + 选手信息 + footer）
- [x] 首页（统计卡片 + 最新题目 + Top5 榜单）
- [x] 题目列表（分类筛选 chips + 搜索 + 卡片网格 + 动态题目标记）
- [x] 题目详情（描述、附件、提交 Flag、连接信息、动态实例面板）
- [x] 我的实例页面（运行中可一键延长或销毁）
- [x] 榜单页（排行表，第一名奖杯标记）
- [x] 个人主页（资料卡片 + 自己的解题记录）
- [x] 404 页面
- [x] 管理后台（分类 CRUD + 题目创建/删除，支持静态与容器化切换）

### 部署与运维
- [x] 多阶段 Dockerfile（backend & worker 共用 alpine + docker-cli）
- [x] Caddy 反代 `/api` → backend、其余 → frontend
- [x] 完整 `make up` / `make up-prod` / `make migrate` 工作流
- [x] backend / worker 容器挂载 `/var/run/docker.sock`，可启动/销毁题目容器
- [x] 端到端联调验证通过（注册→创建容器题→启动实例→提交 dynamic flag→销毁）

## 未实现 / 待办

### P4 社区
- [ ] 公告系统
- [ ] 题目讨论区（嵌套回复）
- [ ] Markdown 渲染
- [ ] 通知中心

### P5 管理 + 高级
- [ ] Admin UI：附件管理界面、题目编辑回填（接口均已实现）
- [ ] 实时记分板（WebSocket）
- [ ] 统计图表
- [ ] 数据导入导出

## 关键决策记录

- **2026-10-17**：选用 Go + React + PostgreSQL；首期只做 Flag 模式（不含代码评测）；不内置任何示例数据。
- **2026-10-17**：UI 设计中性灰 + 靛蓝强调色（`#2f5fce`），统一 1px 边框 + 6~8px 圆角，避免渐变与霓虹；亮/暗双主题跟随系统。
- **2026-10-17**：迁移使用纯 SQL 而非 GORM AutoMigrate，便于审计与回滚。
- **2026-10-17**：附件路由最终调整为 `/challenges/:id/attachments/:attachmentId/...` 以避免 Gin 路径参数冲突。
- **2026-10-17**：Docker Compose 中 postgres/redis 不再向宿主暴露端口（避免与本地服务冲突），仅容器内可见。
- **2026-10-17**：放弃 docker/docker SDK（v25/v28 都有模块路径漂移问题），改用 docker-cli 子进程调用 `/var/run/docker.sock`；在 backend 镜像中 `apk add docker-cli`。

## 已知问题

- 暂无（如发现请在此记录）

## 端到端验证清单（最近一次）

通过 `docker compose up -d --build` 启动后：
- ✅ 应用迁移 `000001 + 000002` 后 instances 表与 challenges 新字段就绪
- ✅ `POST /api/v1/challenges` 创建容器化题目（image / internalPort / TTL）
- ✅ `POST /api/v1/challenges/:id/instance` 启动容器实例，注入 `FLAG` 环境变量
- ✅ 容器对外可达（`curl http://localhost:${port}` 返回 200）
- ✅ `POST /api/v1/challenges/:id/submit` 错误 flag 返回 incorrect；正确 dynamic flag 返回 +500
- ✅ `POST .../instance/:instanceId/extend` 续期成功
- ✅ `DELETE .../instance/:instanceId` 容器销毁，状态置 stopped
- ✅ Worker 容器静默运行（无过期实例时不输出日志）

## 开发常用命令

```bash
make up              # 启动依赖（postgres、redis）
make up-prod         # 构建并启动全部服务（含 backend/worker/frontend/caddy）
make backend-dev     # 后端热重载（cd backend && go run ./cmd/server）
make frontend-dev    # 前端开发服务器（cd frontend && npm run dev）
make migrate         # 通过 docker compose exec 应用 SQL 迁移
make logs            # tail compose 日志
make down            # 停止所有容器
make clean           # 危险：删除所有容器与卷
make fmt / make vet / make test
```

应用迁移的便捷方式：

```bash
docker compose exec -T postgres psql -U ctfoj -d ctfoj < backend/migrations/000001_init.up.sql
docker compose exec -T postgres psql -U ctfoj -d ctfoj < backend/migrations/000002_dynamic_challenges.up.sql
```

## 关键端口与外部依赖

- 容器化题目：宿主机 `30000-40000` 端口范围内随机分配，配置项 `BACKEND_INSTANCE_PORT_MIN/MAX`
- 对外主机：默认 `localhost`（部署到公网时改 `BACKEND_INSTANCE_PUBLIC_HOST`）
- backend 与 worker 容器都挂载 `/var/run/docker.sock`，需要宿主机 Docker daemon 可达

## 待用户决策

- 是否需要团队系统（当前仅个人打分）
- 是否需要 OAuth（GitHub）登录
- 附件存储是否需要 S3 / MinIO 后端
- 容器题目是否使用专用网络隔离（当前用默认 bridge）
