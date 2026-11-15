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
