# Deploy prep for Coolify (phase 08, repo side)

Short design, approved 2026-11-16. Source plan: `docs/plans/08-deploy-coolify.md`.

## Intent
Make the repo deployable to Coolify at `dense.cgdev.site` without touching production: an image
Coolify can build, a health endpoint for its checks, and CI that runs the same gate as local work.
Everything lands on `feature/deploy-coolify` as one PR.

## Goals
- `docker build` produces a small image that runs the app on port 3200 as a non-root user.
- `GET /api/health` answers 200 without the database; `?db=1` also proves the database is reachable.
- CI runs `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm check:drift` on every push and PR.

## Non-goals
- Creating the production `dense_app` role, the Coolify app, env vars, the domain, or any deploy.
  Those follow as separate steps, each confirmed before it runs.
- Any schema change or migration (AGENTS.md hard rule).

## Anti-goals
- An image that migrates, runs `db push`, or needs the budgettracker repo at build time.
- A health check that leaks anything beyond up or down.
- A Prisma engine that only fails on the first query in production.

## Constraints found
- `prisma/schema.prisma` is generated from budgettracker and has no `binaryTargets`, so the engine
  must be generated inside the same Alpine base that runs it, with `openssl` installed.
- `/api/health` is already exempt from the login gate (`src/proxy.ts:58`).
- Both repos are public, so CI checks out budgettracker without a secret.
- The drift test and `check:drift` read the pinned commit (`prisma/.source-sha`) from git, so CI
  checks out budgettracker `main` with full history.
- budgettracker's DENSE release (`202e6de`) has been in production since 2026-11-15.

## Approaches
1. **Multi-stage Dockerfile on `node:24-alpine`, Next standalone output** (picked). Explicit build
   command, small runtime, same base for generate and run, matches plan 08.
2. Nixpacks, as budgettracker uses. Less to write, but the build command and Node version are
   implicit and the Prisma engine target depends on Nixpacks' base image. Plan 08 rules it out.
3. Full `node_modules` image without standalone. Simpler copy step, but several hundred MB larger
   for no gain.

## Design
- `next.config.ts`: `output: "standalone"`.
- `Dockerfile`, every stage `node:24-alpine` with `openssl`:
  - deps: corepack pnpm 11.3.0, `pnpm install --frozen-lockfile`.
  - build: `prisma generate && next build` (the existing `pnpm build`), with a placeholder
    `DATABASE_URL` so nothing connects.
  - runtime: copies `.next/standalone`, `.next/static`, `public` if present; non-root `nextjs`
    user; `HOSTNAME=0.0.0.0`, `PORT=3200`; `node server.js`.
- `.dockerignore`: `.env*` (except `.env.example`), `node_modules`, `.next`, `.git`, tests' noise.
- `src/app/api/health/route.ts`: `GET` returns `{ ok: true }` with `Cache-Control: no-store`.
  With `?db=1` it runs `SELECT 1` through `src/server/db.ts`; failure is 503 `{ ok: false }` with
  no error detail.
- `.github/workflows/ci.yml`: on push and pull_request; checks out this repo and
  `chrisgen19/budget-tracker-2026` (`main`, `fetch-depth: 0`) side by side; Node 24 from `.nvmrc`;
  pnpm via corepack; install, then the four checks with `BUDGETTRACKER_DIR` pointing at the
  checkout.

## Left to the builder
- Exact `.dockerignore` entries and how `public/` is handled if the folder does not exist.
- Health route tests (unit, mocking the Prisma client), and a local `docker build` plus
  `curl /api/health` as verification.
