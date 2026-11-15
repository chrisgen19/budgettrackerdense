# 03 Vendored logic

Goal: reuse budgettracker's tested read queries and its single create path without hand-copying,
and detect the moment the two apps disagree.

## Why vendor instead of rewriting
budgettracker's `transaction-writes.ts` says it plainly: `createTransactionBatch` is the single
create path and "a second copy would drift the moment either changed". The read queries carry
months of fixes (timezone windows, partial periods, label breakdown rules). A generated copy plus a
drift check keeps one source of truth while letting this app deploy on its own.

## What gets copied
Entry files in budgettracker (`$BUDGETTRACKER_DIR/src/...`):

| Entry | Gives this app |
|---|---|
| `lib/budget-queries.ts` | `searchTransactions`, `getMonthlySummary`, `getSpendingByCategory`, `getSpendingTrends`, `getBudgetOverview`, `getUpcomingBills`, `getBillHistory`, `getLabelBreakdown`, `getLabelList`, `getCategoryList`, `describePeriod` |
| `lib/budget-plans.ts` | `getBudgetPerformance(userId, month, tz)` |
| `lib/credit-account-queries.ts` | `getCreditAccountSummaries`, `getCreditAccountDetail`, `monthWindow`, `currentMonthKey`, `shiftMonthKey`, `readTimezoneOffset` |
| `lib/transaction-writes.ts` | `createTransactionBatch` (plan 07) |
| `lib/period-progress.ts` | `localCalendarDay`, `describePeriodProgress`, day helpers |
| `types/index.ts` | `BudgetPerformanceData` and the other shared types |

The sync script follows their imports transitively. From the audit, expect roughly:
`budget-query-types`, `receipt-limits`, `bill-dates`, `bill-estimate`, `money`, `period-progress`,
`budget-performance`, `card-owed`, `card-interest`, `debt-payoff`, `analytics-limits`,
`schedule-server`, `schedule-matching`, `card-purchase-rule`, `validations`, `mcp/scopes`, plus
type-only imports from `assessment-facts`. Let the script discover the real list; do not
hand-maintain it.

Watch-outs found in the audit:
- `budget-plans.ts` imports the shared client `prisma` from `@/lib/prisma` instead of taking a
  parameter. Solved by the shim below, not by editing the copy.
- `validations.ts` is large (zod, MCP scopes). It comes along whole because `formatLocalDate`,
  `resolveTransactionDate` and `BatchTransactionInput` live there. Accept the size; do not trim.
- `assessment-facts.ts` (2,856 lines) is pulled in only for **types** by `credit-account-queries`.
  If the walker follows `import type`, it will copy it; that is fine (types only, no runtime
  cost). Do not vendor `assessment-facts-query.ts` in v1.

## `scripts/sync-vendor.ts`
1. Start from the entry list above. Parse each file's `import ... from "@/..."` and relative
   imports (a regex on `from "..."` is enough; TypeScript's `ts.preProcessFile` is more robust
   and already installed with `typescript`).
2. Copy each reached file to `src/vendor/bt/<same relative path under src/>`, e.g.
   `src/lib/bill-dates.ts` to `src/vendor/bt/lib/bill-dates.ts`.
3. Rewrite import specifiers `@/` to `@bt/`.
4. **Skip** `lib/prisma.ts`: write the shim instead (step 5).
5. Shim `src/vendor/bt/lib/prisma.ts`:
   ```ts
   // GENERATED shim: budgettracker modules that import the shared client get this app's client.
   export { prisma } from "@/server/db";
   ```
6. Prepend to every copied file:
   `// GENERATED from budgettracker@<sha>:src/<path>. Do not edit. Run pnpm sync:vendor.`
7. Never copy `*.test.ts`. Write `src/vendor/bt/MANIFEST.json`: source sha, each file's source
   path and SHA-256 of the transformed content.
8. Script: `"sync:vendor": "tsx scripts/sync-vendor.ts"`.

## `scripts/check-drift.ts`
- Re-runs the schema and vendor transforms **in memory** against the current budgettracker
  checkout and compares to what is on disk. Exit 1 listing each differing file.
- Also fails if any file under `src/vendor/bt/` lacks the GENERATED header (hand-added file).
- Script: `"check:drift": "tsx scripts/check-drift.ts"`.
- In CI (plan 08) budgettracker is checked out next to this repo at `main`, so drift means
  "budgettracker main moved; re-sync and review the diff".

## ESLint and TypeScript
- Exclude `src/vendor/bt/**` and `prisma/**` from ESLint (budgettracker lints them in its own
  config). Keep them in `tsc`: a type error there means the copy no longer fits this app.

## Dense-owned queries (`src/server/queries/`)
The shared queries do not cover everything mockup 04 needs. Write these here, never by editing
the vendor copy:
- `ledger.ts`: `searchTransactions` filters by type, category, amount and search only. The ledger
  also needs **label** and **card** filters and day grouping, so write a dense query with the
  same timezone window rules (use vendored `describePeriod`/`monthWindow`).
- `category-by-month.ts`: category x month matrix for the heat table (one `groupBy` per month or a
  single grouped query on the local-month expression).
- `label-by-month.ts`: label x month matrix for the Labels page.
- `daily-spend.ts`: per-local-day expense totals for the burn chart.

Each takes `(prisma, userId, params)` with an explicit `timezoneOffset`, mirroring budgettracker's
style, and gets unit tests for the date windows.

## Acceptance
- `pnpm sync:vendor` then `pnpm type-check` passes.
- `pnpm check:drift` passes immediately after a sync, and fails after editing one vendored file.
- A smoke test (`scripts/smoke-reads.ts`, run by hand against local) prints
  `getMonthlySummary` for the last 6 months and `getCreditAccountSummaries` for the user, using
  the user's own `timezoneOffset`.

## As built (Nov 2026)
What the sync actually produced, and the two decisions the plan did not anticipate.

**26 vendored files** from entry points `budget-queries`, `budget-plans`, `credit-account-queries`,
`transaction-writes`, `period-progress` and `types/index`, discovered transitively with
`ts.preProcessFile`. The audit's list was right, plus `bill-utils` and `analytics-buckets`.
`assessment-facts.ts` comes along for its types, as expected; `assessment-facts-query.ts` does not.
The transforms are pure modules under `scripts/lib/` (`schema-sync.ts`, `vendor-sync.ts`,
`drift.ts`), so `check-drift.ts` re-runs them in memory rather than re-implementing them.

**`zod` 3.25.76** installed in this phase, matching budgettracker's lockfile, for
`validations.ts`.

**TypeScript: two configs.** budgettracker's source is written without
`noUncheckedIndexedAccess`, which plan 01 turned on here, and it produces ~120 errors under it.
Excluding `src/vendor/bt` from `tsconfig.json` does not help: the files enter the type graph
through imports. So:
- `tsconfig.json` keeps the flag. It is what the editor uses, and `pnpm type-check` runs it as a
  second pass with diagnostics under `src/vendor/bt` dropped (`scripts/type-check.ts`).
- `tsconfig.build.json` extends it with the flag off, and is what `next build` uses
  (`typescript.tsconfigPath`). `pnpm type-check` runs it first, unfiltered, so a vendored file
  that no longer fits this app's Prisma client or config still fails.
Never edit a vendored file to satisfy a rule this repo added.

**Vitest** aliases `server-only` to that package's own empty module, the way the server build
resolves it; without that, importing anything under `src/server/` throws in a test.
`pnpm smoke:reads` runs under `node --conditions=react-server` for the same reason, and loads
`.env` itself.

**Dense queries** are in `src/server/queries/`: `period.ts` (window resolution, delegating to the
vendored `describePeriod` and `monthWindow`), `ledger.ts`, `category-by-month.ts`,
`label-by-month.ts`, `daily-spend.ts`. Each takes `(prisma, userId, params)` with an explicit
`timezoneOffset`. 45 unit tests cover the date windows, the label and card filters, local-day
grouping and the month-column folding.
