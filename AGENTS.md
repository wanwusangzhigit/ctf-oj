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
- 鉴权使用 `Authorization: Bearer <accessToken>`；刷新令牌走 `POST /api/v1/auth/refresh`。
- 列表接口必须分页：`?page=1&page_size=20`，返回 `{ items, total, page, page_size }`。

## 前端约定

- 路由：`/auth/login`、`/auth/register`、`/`、`/challenges`、`/challenges/:id`、`/scoreboard`、`/admin/*`。
- 未登录用户只能访问 `/auth/*` 与 `/`；其他路由重定向到登录页。
- 全局错误使用 toast，不在页面层处理业务错误细节。
- 表单使用 `react-hook-form` + `zod` 校验。
- 数据请求统一走 TanStack Query；本地状态走 Zustand。

## 部署

- 开发：`make up` 启动 db / redis；`make backend-dev`、`make frontend-dev` 分别热重载。
- 生产：`make up-prod`（同时构建前后端镜像并以 Caddy 反代）。
- 端口约定：
  - `8080` 前端（Caddy 反代到前端 SPA + `/api` 到后端）
  - `8081` 后端（仅容器内可见，不对外暴露）
  - `5432` Postgres（仅本地开发暴露）
  - `6379` Redis（仅本地开发暴露）

## 测试

- Go：`go test ./...`；优先表驱动测试。
- 前端：暂不引入测试框架，待页面稳定后评估。

## 路线图

- **P1 地基**：compose、配置、迁移、注册/登录/JWT、健康检查 ✅
- **P2 核心题目**：分类、题目 CRUD、static/regex flag、提交判题、附件、动态打分 ✅
- **P3 容器化题目**：Docker SDK、dynamic flag、实例生命周期、TTL worker（待启动）
- **P4 社区**：公告、讨论区、Markdown、通知（待启动）
- **P5 管理后台 + 高级**：Admin UI、实时记分板、统计图表、导入导出（待启动）

## 当前进度

参考 `memory.md`。
