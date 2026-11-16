# Deploy Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo buildable and checkable for Coolify (image, health endpoint, CI) without touching production.

**Architecture:** A `GET /api/health` route handler with an optional database probe; Next standalone output packaged by a multi-stage `node:24-alpine` Dockerfile; a GitHub Actions workflow running the local gate with budgettracker checked out beside this repo.

**Tech Stack:** Next 16.4.6 (App Router route handlers, `output: "standalone"`), Prisma 6.19.2, Vitest 5, Docker, GitHub Actions, pnpm 11.3.0, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-16-deploy-prep-design.md`

## Global Constraints
- No migrate, `db push` or `db pull` anywhere, including the Dockerfile (plan 02 test enforces scripts).
- Every Docker stage uses `node:24-alpine` with `openssl`; Prisma generates inside that base.
- Runtime: non-root user, `PORT=3200`, `HOSTNAME=0.0.0.0`, `node server.js`.
- pnpm `11.3.0` via corepack (`packageManager` in `package.json`); Node from `.nvmrc` (`24`).
- The health response carries no error detail, only `{ ok: boolean }`, with `Cache-Control: no-store`.
- No new dependencies. No em or en dashes in prose. Conventional Commits.

## Review Focus
- Database down with `?db=1`: expect 503 `{ ok: false }`, not a thrown 500 or a leaked message. (Task 1 test)
- `?db=0`, `?db=true` or any other value: treated as no probe, 200 without touching the database. (Task 1 test)
- Image built without a real `DATABASE_URL`: `next build` must not connect. (Task 2 verification builds with a placeholder)
- Prisma engine mismatch on Alpine: first query must work in the container. (Task 2 verification runs `?db=1` against local Postgres)
- CI drift on a budgettracker `main` that moved past the pin: passes with a note, fails only on hand edits. (Task 3 relies on `check:drift` behaviour from `b88b7b2`)

---

### Task 1: Health route

**Files:**
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/server/db` (`$queryRaw` tagged template).
- Produces: `GET(request: NextRequest): Promise<Response>`, used by Coolify's health check and Task 2's verification.

- [ ] **Step 1: Write the failing tests** (mock `@/server/db` with a `$queryRaw` whose behaviour each test sets)
  - `answers 200 { ok: true } without touching the database`: `GET /api/health`, status 200, body `{ ok: true }`, `$queryRaw` not called, `cache-control` is `no-store`.
  - `probes the database with ?db=1`: status 200, body `{ ok: true }`, `$queryRaw` called once.
  - `answers 503 { ok: false } when the probe fails, with no detail`: `$queryRaw` rejects `new Error("password authentication failed")`; status 503, body exactly `{ ok: false }`.
  - `ignores other db values`: `?db=true` and `?db=0` give 200 without calling `$queryRaw`.
- [ ] **Step 2: Run** `pnpm exec vitest run src/app/api/health/route.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `GET`** using `request.nextUrl.searchParams.get("db") === "1"` and `prisma.$queryRaw\`SELECT 1\``, with `Response.json(body, { status, headers: { "Cache-Control": "no-store" } })`.
- [ ] **Step 4: Run the test again.** Expected: PASS (4 tests).
- [ ] **Step 5: Commit** `feat(health): add /api/health with an optional database probe`.

### Task 2: Standalone output and Dockerfile

**Files:**
- Modify: `next.config.ts` (add `output: "standalone"`)
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Consumes: `pnpm build` (`prisma generate && next build`), Task 1's route.
- Produces: an image that listens on 3200; `.next/standalone/server.js`.

- [ ] **Step 1: Add `output: "standalone"`** and run `pnpm build`. Expected: `.next/standalone/server.js` exists.
- [ ] **Step 2: Write `.dockerignore`**: `.git`, `node_modules`, `.next`, `.env`, `.env.*` with `!.env.example`, `*.tsbuildinfo`, `.playwright-mcp`, `design-reference`, `docs`.
- [ ] **Step 3: Write the Dockerfile**, stages `deps` (corepack, `pnpm install --frozen-lockfile`), `build` (`pnpm build` with `DATABASE_URL=postgresql://build:build@localhost:5432/build` and `NEXT_TELEMETRY_DISABLED=1`), `runtime` (`apk add --no-cache openssl`, user `nextjs` uid 1001, copy `.next/standalone` and `.next/static`, `EXPOSE 3200`, `CMD ["node", "server.js"]`). No `public/` copy: the folder does not exist.
- [ ] **Step 4: Verify the image**: `docker build -t budgettrackerdense:local .`, then run with `--env-file .env -e DATABASE_URL=<local dense_app URL via host.docker.internal> -p 3201:3200`, and `curl` `/api/health` (200 `{"ok":true}`), `/api/health?db=1` (200), `/overview` (307 to `/login`). Container user is `nextjs`.
- [ ] **Step 5: Commit** `build(docker): add a standalone node:24-alpine image on port 3200`.

### Task 3: CI workflow and plan note

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docs/plans/08-deploy-coolify.md` (record what landed and that production steps remain)

**Interfaces:**
- Consumes: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm check:drift`; `BUDGETTRACKER_DIR`.
- Produces: a required-able check named `checks`.

- [ ] **Step 1: Write the workflow**: triggers `push` (branches `main`) and `pull_request`; job `checks` on `ubuntu-latest`; `actions/checkout@v4` into `budgettrackerdense`, and `chrisgen19/budget-tracker-2026` `main` with `fetch-depth: 0` into `budgettracker`; `actions/setup-node@v4` with `node-version-file: budgettrackerdense/.nvmrc`; `corepack enable`; `pnpm install --frozen-lockfile`; the four checks with `working-directory: budgettrackerdense` and env `BUDGETTRACKER_DIR: ../budgettracker`.
- [ ] **Step 2: Validate locally**: YAML parses (`node -e` with no new deps is not possible for YAML, so use `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'`), and the four checks pass locally.
- [ ] **Step 3: Update plan 08** with a short "Repo prep landed" note listing the files and the remaining production steps.
- [ ] **Step 4: Commit** `ci: run lint, type-check, test and drift on push and PR`, push, open the PR, and confirm the workflow passes on it.
