# 08 Deploy to Coolify

Goal: the app on its own subdomain, behind login, on the same Postgres as budgettracker, using the
`dense_app` role. **Production-affecting: confirm each step with Christian before doing it.**

## Before deploying
- budgettracker's DENSE release is live in production (plan 07 step 0), or quick entry ships
  disabled (the guard handles it).
- Local acceptance of plans 01 to 07 passes.

## Build
- `pnpm build` = `prisma generate && next build`. It must never migrate; the test in plan 02
  already asserts no script contains `migrate`.
- `prisma/schema.prisma` and `src/vendor/bt/` are **committed** (generated but checked in), so the
  build does not need the budgettracker repo.
- Prefer a Dockerfile (Next `output: "standalone"`, Node 24 alpine, non-root user, `next start`
  on port 3200) over nixpacks so the build command is explicit. Health check `GET /api/health`
  (returns 200 without touching the DB, plus a `?db=1` variant that runs `SELECT 1`).

## Production role
In the Coolify Postgres terminal, run the role SQL from plan 02 with the final, proven grant list
and a generated password. Store `DATABASE_URL` with `dense_app` only in Coolify's env for this app.
Never reuse budgettracker's owner URL.

Network: if Postgres is a Coolify resource on the same server, use its internal hostname from the
app's network, not a public port.

## Environment (Coolify)
| Var | Value |
|---|---|
| `DATABASE_URL` | `postgresql://dense_app:...@<internal host>:5432/<db>` |
| `SESSION_SECRET` | 32+ random bytes, base64 |
| `ALLOWED_EMAILS` | Christian's login email |
| `NODE_ENV` | `production` |
| `BUDGETTRACKER_URL` | `https://budget.cgdev.site` (links out for editing plans and opening rows) |

## Domain and TLS
`dense.cgdev.site`, next to budgettracker's `budget.cgdev.site`, HTTPS via Coolify's proxy.
Session cookie `Secure` in production.

## CI (GitHub Actions)
On push and PR: checkout this repo and budgettracker (`main`) side by side, `pnpm install`,
`pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm check:drift`. Drift is checked against the
commit in `prisma/.source-sha`, so failing means a generated file was edited here. When
budgettracker `main` has moved past that commit, `check:drift` prints a note instead: re-sync
locally, read the diff, adjust, commit.

## Acceptance
- Logged out: every page redirects to `/login`; `/api/health` returns 200.
- Logged in: Overview numbers match budgettracker production for the same month.
- `dense_app` in production cannot `UPDATE transactions` (same `WHERE false` check as plan 02).
- Revert path: stop the app in Coolify. It owns no schema and no data beyond rows it created
  (identifiable by `created_via = 'DENSE'`), so removing it leaves budgettracker untouched.

## Status (2026-11-16)
Repo prep landed (`docs/superpowers/specs/2026-11-16-deploy-prep-design.md`):
- `Dockerfile` and `.dockerignore`: multi-stage `node:24-alpine` with openssl, standalone output,
  non-root `nextjs`, port 3200. Verified locally: `/api/health` 200, `?db=1` 200 as `dense_app`,
  `/overview` redirects to `/login`.
- `src/app/api/health/route.ts`: 200 `{ ok: true }`; `?db=1` runs `SELECT 1`, 503 `{ ok: false }`
  on failure. Coolify health check: `GET /api/health` on port 3200.
- `.github/workflows/ci.yml`: lint, type-check, test, drift on push to `main` and every PR.
- `pnpm type-check` runs `next typegen` first, so it works on a fresh clone.
- budgettracker's DENSE release (`202e6de`) is in production since 2026-11-15.

Still to do, each confirmed before it runs: the production `dense_app` role and grants, the
Coolify application (Dockerfile build pack, this repo, `main`), its env vars, the domain, the
first deploy, then the acceptance checks above.
