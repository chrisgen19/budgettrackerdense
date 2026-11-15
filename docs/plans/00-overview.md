# 00 Overview

## Why this app exists
The main app (`~/projects/budgettracker`) is tuned for fast daily logging on a phone. Reviewing a
month carefully on a desktop needs something else: everything visible at once, tables instead of
cards, sparklines and a burn chart against budget, keyboard navigation. Mockup 04 (Data-Dense Pro)
was chosen for that. Rather than reshaping the main app, this is a **second app on the same
database**, so each can stay good at its own job.

## Decisions (Nov 2026)
| Topic | Decision | Consequence |
|---|---|---|
| Data access | Read everything; write only quick-entry transactions | One write path, the vendored `createTransactionBatch` |
| Database | Env-driven; build against local Postgres first | Production later via a least-privilege `dense_app` role |
| Hosting | Deployed to Coolify, with login | Auth against the existing `users` table (plan 04) |
| Stack | Next 16, Tailwind 4, Prisma 6, Zod 3 | Prisma and Zod match budgettracker so vendored code runs unchanged |
| v1 pages | Overview, Ledger, New entry, Reports, Cards, Budgets, Bills, Labels | Plan 06 |
| Provenance | New `TransactionSource` value `DENSE` | Needs one expand-only migration PR in budgettracker first (plan 07 step 0) |
| Future FastAPI | Expected later as the CRUD API | Writes sit behind one seam (plan 09) |

## Architecture
```mermaid
flowchart LR
  subgraph dense[budgettrackerdense - Next 16]
    pages[Server components / pages] --> q[src/server/queries]
    pages --> v[src/vendor/bt - read queries]
    action[New entry server action] --> w[src/server/writes.ts]
    w --> vw[vendor/bt createTransactionBatch]
  end
  subgraph main[budgettracker - Next 15]
    app[App + MCP + Telegram] --> ctb[createTransactionBatch]
  end
  q --> db[(PostgreSQL)]
  v --> db
  vw -->|role dense_app| db
  ctb -->|owner role, migrations| db
  main -. schema.prisma + src/lib copied by sync scripts .-> dense
```

Ownership: budgettracker owns the schema, migrations and every business rule. This app copies
the rules it needs (generated, drift-checked) and owns only presentation, its own read queries
for filters the shared ones lack, the command parser, and the session.

## Phases
Each plan ends with acceptance checks. Do them in order; each one is a branch and a PR-sized commit
series.

| # | Plan | Outcome |
|---|---|---|
| 01 | `01-scaffold.md` | Next 16 app boots, lint/type-check/test wired |
| 02 | `02-database.md` | Schema synced, client generated, `dense_app` role works locally, never-migrate guard |
| 03 | `03-vendored-logic.md` | `src/vendor/bt` generated, drift check green, a smoke query returns real rows |
| 04 | `04-auth.md` | Login with existing credentials, every route gated |
| 05 | `05-design-system.md` | Tokens, fonts, primitives, charts, shell with keyboard map |
| 06 | `06-pages.md` | All 8 pages with real data and loading/error/empty states |
| 07 | `07-quick-entry-writes.md` | DENSE enum shipped in budgettracker, then command-line entry writes |
| 08 | `08-deploy-coolify.md` | Running on Coolify behind login, prod role, CI checks |
| 09 | `09-future-fastapi.md` | Reference only: how the write seam moves to FastAPI |

Phase 07's step 0 is a change in **budgettracker**, not here. It can be done in parallel with 05
and 06; writes stay disabled until it is deployed.

## Definition of done (v1)
- All 8 pages render real data for the logged-in user with the user's timezone offset.
- Light and dark mode; layout usable at 390, 768 and 1440 wide (dense tables scroll horizontally
  on a phone rather than collapsing).
- Quick entry creates a transaction indistinguishable in the main app from one made there, except
  `created_via = DENSE`; label schedules and the card-purchase rule apply identically.
- The `dense_app` role cannot `UPDATE` or `DELETE` transactions, verified by a failing attempt.
- `pnpm lint && pnpm type-check && pnpm test && pnpm check:drift` pass in CI.
- Deployed on Coolify; unauthenticated requests get the login page, never data.

## Known data facts (from the Nov 2026 audit)
- Local DB data ended 28 Sep 2026 at audit time; refresh with budgettracker's
  `scripts/refresh-local-mirror.ts` before building pages, or the "current month" is empty.
- No `BudgetPlan` existed for Sep 2026. Budgets must show "no plan for this month" honestly.
- One credit card (BPI). Labels in use: Family Budget, With Mom and Dad Budget, Personal, TNVS,
  Work Budget, Pickleball Budget, Shopee, Credit Card.
