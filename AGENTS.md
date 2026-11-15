# Budget Tracker Dense

A dense, desktop-first review app for Christian's personal budget. It reads the **same PostgreSQL
database** as the main app at `~/projects/budgettracker`, plus one narrow write: quick transaction
entry from a command line. Visual spec: `design-reference/04-data-dense.html`.

Start every session by reading `docs/plans/00-overview.md`, then the plan for the phase in progress.

## Hard rules (must hold on every change)
- **This app never changes the database schema.** `budgettracker` owns `prisma/schema.prisma` and
  every migration. Here there is no `prisma/migrations/`, no `migrate`, no `db push`, no `db pull`
  written back. Schema arrives only through `pnpm sync:schema`. A test asserts this
  (`docs/plans/02-database.md`).
- **Files under `src/vendor/bt/` are generated.** Never edit them by hand. Change the source in
  `budgettracker`, then run `pnpm sync:vendor`. `pnpm check:drift` must pass
  (`docs/plans/03-vendored-logic.md`).
- **Every write goes through `src/server/writes.ts`.** Pages, actions and routes never call Prisma
  `create`/`update`/`delete` directly. This is the seam a future FastAPI service replaces
  (`docs/plans/09-future-fastapi.md`).
- **Transactions are created only by the vendored `createTransactionBatch`**, the same function
  the main app and its MCP server use, with `createdVia: "DENSE"`. Do not write a second create path.
- **Writes are blocked until the `DENSE` enum value exists in the database** (step 0 of
  `docs/plans/07-quick-entry-writes.md`). Until then the New entry page is read-only (preview only).
- **The database role is least privilege** (`dense_app`, see `docs/plans/02-database.md`). Never
  point this app at the database owner role, locally or in production.
- **Timezones:** pass the user's `users.timezone_offset` explicitly to every query. The
  convention is `Date.getTimezoneOffset()` minutes (UTC+8 is `-480`) and local midnight is
  `Date.UTC(y, m, d) + tz * 60000`. Vendored queries default to UTC when the offset is missing,
  which silently returns the wrong month.
- **Money:** every figure uses IBM Plex Mono with tabular numerals, formatted `₱12,345.00`.
  `BudgetAllocation.amount` is a Prisma `Decimal`; convert with `Number()` once at the boundary.
- Ask before adding any dependency not listed in `docs/plans/01-scaffold.md`.

## Stack
- Next.js 16 (App Router, `proxy.ts`), React, TypeScript strict
- Tailwind CSS 4 (CSS-first `@theme`, tokens as CSS variables, light + dark)
- Prisma 6 (`prisma-client-js`), matching `budgettracker` so vendored code runs unchanged
- Zod 3 (matches `budgettracker`'s vendored validations)
- Vitest for unit tests; Playwright only if a flow needs a real browser
- Charts: hand-written SVG components ported from `design-reference/shared/core.js` (no chart lib)
- Icons: lucide-react. Fonts: IBM Plex Sans Condensed + IBM Plex Mono via `next/font/google`
- pnpm, Node 24 LTS
- Go by the **installed** versions (types in `node_modules`, bundled docs) rather than memory,
  especially for Next 16, Tailwind 4 and Prisma.

## Commands (target state; created in phase 01)
- `pnpm dev`: dev server on `127.0.0.1:3200`
- `pnpm build` / `pnpm start`: production build, never touches the database
- `pnpm lint`, `pnpm type-check`, `pnpm test`
- `pnpm sync:schema`: copy `../budgettracker/prisma/schema.prisma`, then `prisma generate`
- `pnpm sync:vendor`: regenerate `src/vendor/bt/` from `../budgettracker/src`
- `pnpm check:drift`: fail if schema or vendored files differ from a fresh sync

## Layout (target)
```
src/
  app/                  routes: (auth)/login, (app)/{overview,ledger,new,reports,cards,budgets,bills,labels}
  components/ui/        Panel, DataTable, KpiStrip, Kbd, FilterToken, MoneyCell, EmptyState, Skeleton
  components/charts/    Sparkline, BurnChart, MonthBars, DayBars, HeatTable
  server/
    db.ts               the Prisma client (dense_app role)
    session.ts          getCurrentUser(), session cookie
    writes.ts           the only write seam
    queries/            dense-owned read queries (ledger with label/card filters, label x month)
  lib/                  pure helpers: money, dates, command parser, keyboard map
  vendor/bt/            GENERATED copy of budgettracker read/write logic
prisma/schema.prisma    GENERATED copy, never edited here
scripts/                sync-schema.ts, sync-vendor.ts, check-drift.ts
```

## Code style
Same as Christian's defaults: named exports (framework files excepted), `function` components,
arrow utilities, `unknown` over `any`, kebab-case files, functions about 50 lines, components about
150 lines, no `console.log` in app code, loading/error/empty states on every view. Conventional
Commits on `feature/*` / `bugfix/*` branches; never commit to `main`. No em or en dashes in prose.

## Before calling anything done
`pnpm lint && pnpm type-check && pnpm test && pnpm check:drift`, and check the UI at 390, 768 and
1440 wide in light and dark.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
