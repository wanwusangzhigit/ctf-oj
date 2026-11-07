# Contributing

Contributions are welcome. Issues and pull requests may be written in English or
Chinese; code, identifiers and commit messages are English.

This document is the reference for how changes are expected to be structured. If you
disagree with a rule, open an issue about the rule before writing code against it.

## Prerequisites

- Go 1.22 or newer
- Node.js 20 or newer, with npm (the repository locks `package-lock.json`)
- Docker with the Compose v2 plugin
- Linux or macOS. Dynamic challenges require a Docker daemon reachable by the backend
  process; on macOS that means a working `DOCKER_HOST`.

## Getting a development instance up

```bash
cp .env.example .env       # change BACKEND_JWT_SECRET and the Postgres passwords
make up                    # postgres + redis containers
make migrate               # apply SQL migrations
make backend-dev           # http://localhost:8081
make frontend-dev          # http://localhost:5173, proxies /api to 8081
```

For the packaged stack instead:

```bash
make deploy                # secrets + migrations + image build + health check
# or
make up-prod               # rebuild and start everything behind Caddy on :8080
```

The first registered account is an ordinary user. Promote it with the SQL in the
README's "First administrator" section; there is no built-in account and there will not
be one.

## Migrations

- Plain SQL files in `backend/migrations/`, named `NNNNNN_description.up.sql` and
  `NNNNNN_description.down.sql`, applied in lexicographic order.
- Migrations create structure only. **No sample challenges, users, announcements or
  teams.** The single exception is a structural default for a new catalog table — the
  four default community boards in `000031_community_sections.up.sql` are the only such
  case, and they exist because the feature's shape is defined by those rows.
- Nothing migrates on application start. `make migrate` (i.e. `scripts/migrate.sh`) is
  the only path, and it runs each file in its own transaction: a failing file rolls
  back completely and later files are not applied.
- Write the `.down.sql` alongside the `.up.sql` and run it once against a scratch
  database before opening the pull request.
- `--baseline-existing` marks pending migrations as applied **without executing them**.
  It is for adopting an already-migrated external database, never for a normal install.
- Constraints that must change shape (for example a `CHECK` on `discussions`) are
  dropped and re-added in the same transaction, with the backfill ordered before the
  new constraint.

## Backend layout and layering

```
api  ->  service  ->  domain  <-  infrastructure/repository
```

- `internal/api/v1` — handlers. Bind and validate the request, call exactly one
  service, map the result. Handlers never reach for a repository.
- `internal/api/middleware` — authentication, permission gates, rate limiting,
  instance gating.
- `internal/domain` — entities, sentinel errors, repository interfaces. No GORM here.
- `internal/service` — business rules and authorization decisions. This is where a
  permission question gets answered once, in a function you can table-test.
- `internal/repository` — GORM implementations of the domain interfaces.
- `internal/infrastructure` — db, cache, storage, docker, mailer, metrics, realtime,
  logger.
- `internal/pkg` — business-free helpers (crypto, response envelope, totp).

Dependencies only point inward. A service must not import another layer's
implementation, and cross-service wiring happens in `cmd/server/main.go`.

## API conventions

- Prefix `/api/v1`.
- Envelope `{ "code": 0, "data": …, "message": "ok" }`; business errors carry
  `code != 0`. HTTP status stays semantic: `200/201/400/401/403/404/409/429/500`.
- The message a client sees comes from `response.classify`, not from the error you
  wrapped. Write errors for logs; the frontend renders text based on the numeric `code`.
- List endpoints require `?page=1&page_size=20` and return
  `{ items, total, page, page_size }`.
- Sessions are HttpOnly cookies (`ctf_oj_access`, `ctf_oj_refresh`) with
  `Authorization: Bearer <accessToken>` accepted as an equivalent.
- Resource permissions use `permission: view | manage`, where `manage` implies `view`.
  Delegated write operations are audited with `delegated: true` and the exact grant,
  e.g. `challenge:12:manage` or `community_section:3:manage`.
- Community boards (`community_sections`) carry their own copy and may override the
  site-wide visibility/posting policy with `''` meaning "inherit". Board grants live in
  `community_section_grants` and are deliberately **not** part of `delegations`.

## Frontend conventions

- Strict TypeScript. Prefer `type` over `interface` unless the type is merged. No `any`;
  use `unknown` at boundaries.
- Colors, radii and spacing come from `src/styles/tokens.css` and the Tailwind preset.
  No hex literals inside components.
- Fonts are bundled (`frontend/public/fonts`, Inter + JetBrains Mono, OFL licensed).
  No CDN, no Google Fonts, no remote scripts or images.
- Rich text renders through the `Markdown` component (react-markdown +
  rehype-sanitize). `dangerouslySetInnerHTML` is not acceptable.
- Overlays use `components/ui/Modal`; destructive confirmations use `useConfirm()`.
  `window.confirm`, `alert` and `prompt` are banned.
- Forms use `react-hook-form` + `zod`, with the same limits as the backend validator.
- Server data goes through TanStack Query, local UI state through Zustand. Reuse an
  existing query key rather than adding a parallel one, and invalidate everything the
  mutation can affect.
- Admin write operations get their own route
  (`/admin/challenges/new`, `/admin/competitions/:id/edit`, …). Modals are for read-only
  detail and for genuinely tiny inputs.
- **Never ship an entry point to something that is not implemented.** No placeholder
  buttons, no disabled "coming soon" features without a real roadmap entry, no UI that
  implies a capability the API does not have.
- Global errors are surfaced as toasts; do not reimplement business-error handling per
  page.

## Style

- Go: [Effective Go](https://go.dev/doc/effective_go). Wrap errors with context
  (`fmt.Errorf("%w: …", domain.ErrX)`), keep comments sparse and only where the *why*
  is not obvious.
- Table-driven tests are the default in Go. There is no frontend test framework;
  page-level regressions are performed against a running instance.
- Run `make fmt` before committing Go changes.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(community): section tabs and per-section grants`,
  `fix(instance): release port on early stop`, `docs`, `refactor`, `test`, `chore`.
- One logical change per commit. Do not mix a migration with a UI restyle.
- Fill in the pull request template, including the verification block with the commands
  you actually ran.
- Keep the README's screenshots current when the UI changes materially; they live in
  `.github/assets/` and are captured from a local build.
- Do not commit `.env`, `backups/*.dump`, or anything produced by `make backup`. These
  paths are ignored for a reason: a dump contains every account, flag and submission.

## Reporting problems

Security vulnerabilities: see [SECURITY.md](SECURITY.md). Everything else: use the
issue forms.

## License

By contributing you agree that your contribution is licensed under the
GPL-3.0-only terms of this repository.
