# memory.md

项目工作记忆与状态记录。每次会话开始时先读这份文件，了解当前进展。

## 当前状态

**阶段**：P1 地基 + P2 核心题目 + 最小可用 Admin 已完成并通过端到端验证
**最后更新**：2026-10-17

## 已完成功能

### P1 地基
- [x] `docker-compose.yml`（postgres、redis、backend、frontend、caddy）
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

### 前端（HydroOJ 现代简洁风）
- [x] Vite + React + TS + Tailwind 骨架
- [x] 设计令牌（中性灰 + 靛蓝强调色，亮/暗双主题跟随系统）
- [x] 基础 UI 组件：Button、Input、Textarea、Field、Card、Badge、Spinner、Toast
- [x] 路由 + 鉴权守卫（RequireAuth、RequireAdmin、PublicOnly）
- [x] Axios 拦截器 + 自动刷新 token + TanStack Query + Zustand auth store
- [x] 登录 / 注册页面（左侧介绍 + 右侧表单的简洁布局）
- [x] 主布局（顶部导航 + 选手信息 + footer）
- [x] 首页（统计卡片 + 最新题目 + Top5 榜单）
- [x] 题目列表（分类筛选 chips + 搜索 + 卡片网格）
- [x] 题目详情（描述、附件、提交 Flag、连接信息、题目元信息）
- [x] 榜单页（排行表，第一名奖杯标记）
- [x] 个人主页（资料卡片 + 自己的解题记录）
- [x] 404 页面
- [x] 管理后台（分类 CRUD + 题目创建/删除，仅管理员可见）

### 部署与运维
- [x] 多阶段 Dockerfile（backend 静态二进制 / frontend nginx SPA）
- [x] Caddy 反代 `/api` → backend、其余 → frontend
- [x] 完整 `make up` / `make up-prod` / `make migrate` 工作流
- [x] 端到端联调验证通过（注册→登录→创建分类→创建题目→提交 Flag→打分→榜单）

## 未实现 / 待办

### P3 容器化题目
- [ ] Docker SDK 集成
- [ ] dynamic flag 注入
- [ ] 实例生命周期管理（启动 / 销毁 / TTL）
- [ ] worker 服务定时清理
- [ ] 容器题目的 UI 入口（当前 UI 不展示，避免幻觉）

### P4 社区
- [ ] 公告系统
- [ ] 题目讨论区（嵌套回复）
- [ ] Markdown 渲染
- [ ] 通知中心

### P5 管理 + 高级
- [ ] Admin UI：附件管理界面（接口已实现，UI 待补）、题目编辑回填
- [ ] 实时记分板（WebSocket）
- [ ] 统计图表
- [ ] 数据导入导出

## 关键决策记录

- **2026-10-17**：选用 Go + React + PostgreSQL；首期只做 Flag 模式（不含代码评测）；不内置任何示例数据。
- **2026-10-17**：UI 设计中性灰 + 靛蓝强调色（`#2f5fce`），统一 1px 边框 + 6~8px 圆角，避免渐变与霓虹；亮/暗双主题跟随系统。
- **2026-10-17**：迁移使用纯 SQL 而非 GORM AutoMigrate，便于审计与回滚。
- **2026-10-17**：附件路由最终调整为 `/challenges/:id/attachments/:attachmentId/...` 以避免 Gin 路径参数冲突。
- **2026-10-17**：Docker Compose 中 postgres/redis 不再向宿主暴露端口（避免与本地服务冲突），仅容器内可见。

## 已知问题

- 暂无（如发现请在此记录）

## 端到端验证清单（最近一次）

通过 `docker compose up -d --build` 启动后：
- ✅ `/api/v1/challenges` 返回空列表（迁移后无内置数据）
- ✅ `POST /api/v1/auth/register` 注册用户成功
- ✅ `POST /api/v1/auth/login` 登录返回 JWT
- ✅ `POST /api/v1/categories` 创建分类成功（需 admin 角色）
- ✅ `POST /api/v1/challenges` 创建题目含 static flag 成功
- ✅ `POST /api/v1/challenges/:id/submit` 错误 flag 返回 incorrect，正确 flag 返回 +500 分
- ✅ `/api/v1/users/me` 分数已更新
- ✅ `/api/v1/users/scoreboard` 榜单含该用户
- ✅ 前端 `/` 与静态资源返回 200

## 开发常用命令

```bash
make up              # 启动依赖（postgres、redis）
make up-prod         # 构建并启动全部服务（含 backend/frontend/caddy）
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
```

## 待用户决策

- 是否需要团队系统（当前仅个人打分）
- 是否需要 OAuth（GitHub）登录
- 附件存储是否需要 S3 / MinIO 后端
