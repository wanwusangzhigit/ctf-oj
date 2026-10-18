# CTF-OJ

一个面向 CTF（Capture The Flag）练习的在线评测系统，对标信息学竞赛界的 HydroOJ，但专注于 CTF 题型（Web / Pwn / Crypto / Reverse / Misc / Forensics）。

## 设计目标

- **简洁现代的 UI**：以 HydroOJ 为参照，注重留白、排版与可读性，避免堆砌特效。
- **可独立部署**：单机 `docker compose up` 即可启动整套服务。
- **支持容器化题目**：Pwn / Web 类题目可为每位选手启动独立容器并动态注入 flag。
- **混合打分**：CTFd 风格的衰减打分（解题人数越多分值越低）。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.22 · Gin · GORM |
| 数据库 | PostgreSQL 16 · Redis 7 |
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS |
| 部署 | Docker Compose · Caddy |

## 目录结构

```
ctf-oj/
├── backend/        Go 后端（API server + worker）
├── frontend/       React 前端
├── deploy/         Caddy / Postgres 部署配置
├── docs/           架构文档
├── docker-compose.yml
└── Makefile
```

详见 [AGENTS.md](./AGENTS.md) 与 [memory.md](./memory.md)。

## 快速开始

```bash
cp .env.example .env
make up            # 启动所有服务
make migrate       # 执行数据库迁移
make backend-dev   # 热重载开发后端
make frontend-dev  # 启动前端开发服务器
```

访问 `http://localhost:8080` 即可。

## 当前阶段

P1 地基 + P2 核心题目 + P3 容器化题目 已完成，并通过端到端验证。

- 用户注册、登录、JWT 刷新
- 题目分类、静态 / 正则 Flag、附件下载
- 容器化题目（Docker 实例、动态 Flag、TTL 自动回收）
- 动态打分、提交记录、解题榜
- 管理后台：分类 CRUD + 题目创建 / 删除（支持静态与容器化切换）

详见 [memory.md](./memory.md)。

## License

MIT
