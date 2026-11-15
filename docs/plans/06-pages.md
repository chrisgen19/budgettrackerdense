# 06 Pages

Every page: server component, `getCurrentUser()` first, the user's `timezoneOffset` passed
explicitly to every query, filters in the URL (`searchParams`) so a view is linkable and the back
button works, and four states: loading (`loading.tsx` with panel-shaped skeletons), error
(`error.tsx` saying what failed and offering retry), empty (says what is missing and what to do),
data. Month navigation `?month=YYYY-MM` defaults to the user's current month via vendored
`currentMonthKey(tz)`.

Data function legend: **bt** = vendored from budgettracker, **dense** = `src/server/queries/`.

## Overview `/overview`  (mockup: Dashboard)
- Over-budget `Flag` when actual > planned for the month: amount over, day crossed, projected
  month end (`spent / daysElapsed * daysInMonth`).
- `KpiStrip`: Income, Spent (delta vs previous month), Budget, Remaining (% used, day n/N),
  Burn/day (vs pace), Net. Sparklines from the last 6 months.
- Panels: Cumulative spend vs budget (`BurnChart` + `DayBars`); Recent (last 9 rows);
  Categories (month, delta vs previous, 6-month sparkline); Labels (count, amount, share bar);
  Payment sources (cash/debit spend, each card's month spend, owed, utilization).
- Data: bt `getMonthlySummary` (6 months), bt `getBudgetPerformance` (plan, totals, safe-to-spend),
  dense `daily-spend`, bt `getSpendingTrends` or `getSpendingByCategory` for current and previous
  month, bt `getLabelBreakdown`, bt `getCreditAccountSummaries`, dense `ledger` (limit 9).
- **No plan for the month:** Budget KPI shows "No plan" with a link to budgettracker's budget
  editor; Remaining and the burn chart's budget line are omitted rather than faked.

## Ledger `/ledger`  (mockup: Transactions)
- Filter bar: search (`/`), date presets (today, 7d, month, custom range), category, label, card,
  type, amount min/max. All URL params.
- `DataTable` grouped by local day with a subtotal row per day; columns Time, Description,
  Category, Labels, Source, Amount; `j/k` row selection; `Enter` opens a read-only detail drawer
  (receipt breakdown, created via, linked bill).
- Server-side pagination (50 per page) with totals for the whole filtered set shown in the header.
- Data: dense `ledger` (adds label and card filters that bt `searchTransactions` lacks).
- Editing and deleting stay in budgettracker in v1; the drawer links there.

## New entry `/new`  (mockup: Quick add)
Specified in `07-quick-entry-writes.md`. Until the DENSE enum ships, the page parses and previews
but the Save button is disabled with an explanation.

## Reports `/reports`  (mockup: Monthly report)
- `MonthBars` for a range (default last 6 months, selectable 3/6/12).
- Category x month `HeatTable` with Avg column, then Total spend, Income, Net rows. Months with no
  rows show "no data", never 0.
- Data: bt `getMonthlySummary`, dense `category-by-month`.

## Cards `/cards`, `/cards/[id]`
- List: each card's balance owed, limit, available, utilization (red above 80%), statement and due
  day, planned payment.
- Detail `?month=`: purchases and payments for the month, opening and closing balance, interest
  and fees (ordinary expenses, see budgettracker `.claude/rules/cards.md`).
- Data: bt `getCreditAccountSummaries`, bt `getCreditAccountDetail(prisma, userId, id, month, tz)`.
- Rule to respect: a card payment is not a transaction and must never appear in expense totals.

## Budgets `/budgets`
- For `?month=`: allocations table (category, kind, planned, rollover carry-in, available, actual,
  remaining, variance %), totals, projected spend, safe-to-spend per day/week/until next income,
  treatment notes, revision history.
- Read-only; editing a plan links to budgettracker.
- Data: bt `getBudgetPerformance(userId, month, tz)` (uses the prisma shim).
- Empty: "No budget plan for <Month>" plus last month's plan summary if one exists.

## Bills `/bills`
- Upcoming and overdue (amount or forecast for variable bills, due date, days until, reminder),
  then a history table per bill (paid, skipped, snoozed occurrences).
- Data: bt `getUpcomingBills`, bt `getBillHistory`. All bill dates are UTC calendar-day
  arithmetic (budgettracker `.claude/rules/bills.md`); render them as dates, never shift by tz.

## Labels `/labels`
- Label x month table (Family Budget, TNVS, Work Budget...) with counts and totals, share of the
  month, and a 6-month sparkline per label; click a label to open the Ledger filtered by it.
- Data: dense `label-by-month`, bt `getLabelList` for colours and `applicableTo`.

## Acceptance (per page)
- Renders real data for the current month and for a past month via `?month=`.
- Numbers match budgettracker for the same month and filters (spot-check three figures per page
  against the main app; write them in the PR description).
- Loading, error (simulate by pointing at a bad DATABASE_URL in dev), and empty (a future month)
  states all render.
- Checked at 390, 768, 1440 in light and dark.

## Overview, as built (Nov 2026)
The first page of this phase. The other seven are still to do.

**One read module, `src/server/queries/overview.ts`.** The page awaits a single
`fetchOverview(prisma, userId, { timezoneOffset, month })`; every figure on screen comes from it.
`timezoneOffset` is threaded into every call by hand, never defaulted: the vendored queries fall
back to UTC when it is missing, which silently returns the wrong month.

| Figure | Source |
|---|---|
| Income, Spent, Net, the six-month sparklines | bt `getMonthlySummary` |
| Spent vs last month, and the Categories Δ | bt `getSpendingTrends` |
| Budget, Remaining, day n/N | bt `getBudgetPerformance` |
| Burn chart and day bars | dense `fetchDailySpend` |
| Category colours and six-month trend lines | dense `fetchCategoryByMonth` |
| Labels | bt `getLabelBreakdown` |
| Owed and utilization | bt `getCreditAccountSummaries`, `asOf` the end of the month shown |
| Per-source spend, Recent rows | dense `fetchLedger` |

Two choices worth recording:
- **`getSpendingTrends`, not two calls to `getSpendingByCategory`.** It clips both months to the
  same day while the current one is running. A part-month against a whole one reads as a saving in
  every category whose bill has not landed yet -- budgettracker's #236. The Categories panel's
  meta says "to date" when the clip is in force.
- **`getMonthlySummary` is sliced, not re-implemented.** It only counts back from today, so
  viewing September in November asks for enough months to reach it and keeps the six ending there
  (`sparkWindow`). A second monthly rollup would be a second definition of what a month's spend is.

**No plan means no budget figures.** `getBudgetPerformance().plan === null` is the whole test.
The Budget KPI then reads "No plan" and links to budgettracker's plan editor, Remaining reads
`−` with "needs a budget plan", and the burn chart draws neither the dashed budget line, the
dotted pace line, nor the red threshold on the day bars; its meta says "no budget plan for this
month". Nothing is averaged into a stand-in. The mockup's "5-mo avg" sample figure was exactly
the thing not to ship: an average of previous months renders identically to a target somebody set.

**Four states.** `loading.tsx` repeats the page's own shape -- six KPI cells, five panels at their
real heights -- so nothing moves when the data lands. `error.tsx` says the read failed and offers
a retry, and never degrades into the empty state: for money, "nothing was spent" and "the query
failed" are different answers and only one of them is reassuring. Empty is a month with no rows,
and distinguishes a month that has not started from one that was simply not logged.

**Also in this commit:** `src/lib/month.ts` was deleted. It duplicated the vendored
`currentMonthKey`, which the plan names, and the shell now uses the vendored one.

### Figures spot-checked against budgettracker
Both apps read the same local database (`budgettracker-nextjs`); budgettracker's own source was
run against it directly, as the owner role, for September 2026 with `timezoneOffset: -480`.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| Spent | 81,578.35 | 81,578.35 | `getMonthlySummary` (and dense `fetchDailySpend` totals the same, a third path) |
| Spent vs August | −13,735.52 (from 95,313.87) | −13,735.52 | `getSpendingTrends` |
| BPI owed / utilization, end of Sep | 76,566.08 / 81.5% | 76,566.08 / 81.5% | `getCreditAccountSummaries` |

Also matching: Income 79,953.66, Net −1,624.69, Housing Δ −1,049.30, Transportation Δ +1,998.40,
Family Budget 37 rows / 29,356.73.

### Acceptance, checked
| Check | Result |
|---|---|
| Current month, and a past month via `?month=2026-09` | Both render; `?month=` is validated and falls back rather than erroring |
| Numbers match budgettracker | Three figures above, plus six more |
| Loading | Proven by the streamed HTML: a response cut at 3s while the query took 6s already carries `aria-busy="true"` and the panel headers |
| Error | Rendered by forcing a throw in a disposable copy: headline, digest reference, "Try again" |
| Empty | November 2026 has no rows: "No entries for November 2026" |
| 390 / 768 / 1440, light and dark | No horizontal page scroll at any width (`scrollWidth === innerWidth`); sidebar at 1440, tab row below 900; KPI strip 6-up then 2-up; Trend and Share columns hidden below 700 |
| `next build` | Passes |

**Not exercised locally:** the over-budget `Flag`, the dashed budget line and the red day bars.
No `BudgetPlan` row exists in the local mirror for any month, and this app must never write one.
Those paths are built and typed but have not been seen with real data.
