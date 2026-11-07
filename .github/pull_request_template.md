## What

Describe the change in one or two paragraphs. Link the issue it closes with
`Closes #123` (or `Refs #123` when it is only part of the work).

## Why

What problem does this solve, and what did you rule out on the way here?

## User-visible changes

List what a player, a team member or an administrator sees differently. Delete this
section when nothing user-facing changes.

## Migration

- [ ] No migration needed
- [ ] New migration `NNNNNN_name.up.sql` / `.down.sql`
- [ ] The down migration was run and reviewed
- [ ] One-off backfill SQL is documented below (and is idempotent)
- [ ] Existing installations need `./scripts/migrate.sh --baseline-existing` — explain
  why below (this is only correct when the schema already matches by other means)

Migrations create structure only. Never seed sample challenges, users or
announcements.

## Verification

Paste the commands you ran and their result, not a description of them.

```
make vet
cd backend && go build ./... && go test ./...
cd frontend && npm run typecheck && npm run build
```

- Browser regression: `N` scenarios on `/challenges`, `/competitions/:id`, `/community`,
  `/admin/…` (list them; note the viewport if the change is layout-related)
- API checks worth recording (method, path, expected status):
  - `POST …` → `201`
  - `PATCH …` → `403` for a non-holder of the grant

## Checklist

- [ ] Migrations do not seed example data
- [ ] Colors come from `frontend/src/styles/tokens.css`; no hex literals in components
- [ ] No `dangerouslySetInnerHTML`; rich text goes through `Markdown`
- [ ] No `window.confirm` / `alert` / `prompt`; destructive actions use `useConfirm`
- [ ] Forms use `react-hook-form` + `zod`; data fetching uses TanStack Query
- [ ] Admin write operations are their own routes, not in-page modals
- [ ] No UI entry point for functionality that is not implemented
- [ ] README screenshots updated if the UI changed materially (`.github/assets/`)
- [ ] `git status` shows no `backups/*.dump` and no `.env` staged
