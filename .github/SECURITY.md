# Security policy

## Supported versions

This project is pre-1.0. Security fixes are made against the latest commit on the
default branch (`main`); older commits and forks are not tracked separately. If you are
running an older deployment, note the commit when you report so we can tell whether the
problem still exists.

## Reporting a vulnerability

**Do not open a public issue, discussion or pull request.**

Report privately through GitHub:
<https://github.com/wanwusangzhigit/ctf-oj/security/advisories/new>

A useful report contains:

- the commit or image tag you tested, and how the stack was run
  (`make deploy`, `make up-prod`, source, containerized or not)
- the affected endpoint or code path, with the request that triggers it
- whether the finding requires an authenticated role (player, captain, moderator,
  admin) or works anonymously
- a reproduction that does not depend on your own data
- any impact on other tenants of the same instance (other players' flags, other
  competitions' scores, other users' sessions)

We aim to acknowledge within 7 days. This is an unpaid open-source project, so that is
an intention, not a contractual SLA. Coordinated disclosure timing is up to you; we will
not push a fix that names the reporter without asking first.

## Architecture facts that shape what "secure" means here

These are properties of the design, not bugs. Read them before filing, and read them
again before exposing an instance to a network.

**The backend container mounts the host Docker socket.**
`docker-compose.yml` binds `/var/run/docker.sock` into the `backend` service so it can
start, inspect and stop challenge containers. Anything that achieves code execution in
the backend therefore controls the host's Docker daemon, which is effectively root on
that host. Deploy the backend on a dedicated machine or VM, not beside unrelated
services, and treat every input that reaches it as hostile.

**Player instances publish host ports.**
Dynamic challenges allocate host ports in
`BACKEND_INSTANCE_PORT_MIN`–`BACKEND_INSTANCE_PORT_MAX` (default 30000–40000) and players
connect to `BACKEND_INSTANCE_PUBLIC_HOST`. Those containers run challenge-supplied
images. Firewall the range so only the players who should reach it can, and never point
`BACKEND_INSTANCE_PUBLIC_HOST` at an address that is already public.

**The API port is internal, but only because of the compose file.**
Backend `8081` and frontend `80` are `expose`d, not `publish`ed; Caddy is the only thing
bound to the host (`${PUBLIC_HTTP_PORT:-8080}`). If you edit the compose file, keep it
that way.

**Static and regex flags are stored in the database in plaintext.**
So is every submission and every score. A `make backup` dump is a secret: it hands over
the whole contest. `backups/` and `*.dump` are git-ignored; treat copies of them like
credentials.

**Session handling.**
Access and refresh tokens are HttpOnly cookies scoped to `/api/v1`, with a 15-minute
access TTL and a 720-hour refresh TTL by default. `BACKEND_JWT_SECRET` signs every
session; the shipped value is a placeholder. `make deploy` generates real secrets and
`chmod 600 .env` — use it, or set the values yourself before the first boot. Changing
the secret invalidates all sessions, which is the current way to force a re-login.

**Registration is open by default** (`BACKEND_REGISTER_OPEN=true`) and rate limiting is
per client (`BACKEND_RATE_LIMIT_RPM`, default 120). Close registration before a contest
if you do not want self-service accounts.

**Authorization is enforced server-side in two places.** Middleware gates the route,
the service re-decides per resource (`view` / `manage`, site-wide and per-board grants,
competition and team membership). A change that only touches middleware is not a fix;
look for the service-level decision. Delegated operations are recorded in the audit log
with the grant that allowed them.

## Out of scope

- Findings that require already having root on the Docker host or the database.
- Vulnerabilities inside challenge images or source you wrote yourself — that content
  runs by design and is expected to be attackable.
- Denial of service against a public contest from anonymous traffic, except where a
  missing rate limit or an unbounded query is the cause.
- Reports against a fork or a modified deployment; state what you changed.
