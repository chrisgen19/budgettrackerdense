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

## Ledger, as built (Nov 2026)
The second page of this phase. Overview and Ledger are done; six remain.

**`fetchLedgerPage` (`src/server/queries/ledger-page.ts`)** wraps this app's own `fetchLedger` and
the three lists the filter bar needs (`getCategoryList`, `getLabelList`,
`getCreditAccountSummaries`). `timezoneOffset` is passed into every call by hand, never defaulted:
the vendored queries fall back to UTC, which puts a UTC+8 user's late-evening rows on the wrong
day and so in the wrong day-group.

This is the page the dense ledger was written for. budgettracker's `searchTransactions` filters by
type, category, amount and description; it has no label or card filter, and returns no day
grouping. Both are the point here.

**Every filter is a URL parameter** (`src/lib/ledger-filters.ts`, 19 tests): `month`, `range`
(`today` / `7d`), `from`/`to`, `q`, `cat`, `label` (repeatable), `card` (an id or `none`), `type`,
`min`, `max`, `page`, and `tx` for the open row. Consequences worth stating:
- The filter bar is links and one GET form, so the server renders the result and nothing waits on
  JavaScript. Chips are `FilterLink`, a new primitive: `aria-current`, not `aria-pressed`, because
  a link is not a toggle button.
- Any change but paging returns to page 1. Staying on page 7 of a list that now has two pages
  shows an empty table and reads as "no results".
- An explicit `from`/`to` wins over `month`, because the shared queries refuse both at once.
- Anything malformed is dropped rather than raised: a stale link shows an unfiltered month.
  A day is validated by round-tripping it through `shiftCalendarDay`, because `Date.parse` accepts
  `2026-02-31` and silently rolls it to 3 March.

**The drawer is a URL, not client state.** `?tx=` renders a read-only panel inside a native
`<dialog>`, so a row is shareable, the back button closes it, and Escape and focus trapping come
from the platform. `fetchTransactionDetail` is a separate one-row read: a table of 50 rows does not
need provenance, the linked bill or the receipt, and joining them per row would be three more reads
for data nobody is looking at. It scopes by `userId` inside the `where`, not by a comparison after
the fetch. Editing stays in budgettracker; the panel links there.

**Keyboard.** `j`/`k` move through `[data-row]`, skipping the day headings, and Enter follows the
row's description link, which is the same `?tx=` URL. `Esc` now clears the filters: the provider
announces a `dense:dismiss` event when it had no dialog of its own open, and the page listens
(`src/lib/dismiss.ts`). It only listens when something is actually filtered, so Escape on a plain
list does not push a pointless history entry.

**Not applicable here:** the instruction to omit budget figures without a plan belongs to the
Overview. The Ledger shows no budget figures at all; its header totals are sums of the matched
rows, over the whole filtered set rather than the visible page.

### Figures spot-checked against budgettracker
budgettracker's own source was run against the same local database, as the owner role, for
September 2026 with `timezoneOffset: -480`.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| All rows, September | 140 rows, in 79,953.66, out 81,578.35, net −1,624.69 | identical | `searchTransactions` |
| Expenses only | 138 rows, 81,578.35 | 138 / 81,578.35 | `searchTransactions` with `type: EXPENSE` |
| Search "coffee" | 5 rows, 3,959.18 | 5 / 3,959.18 | `searchTransactions` with `search` |

Transportation as a category also matches on both sides: 45 rows, 6,323.80 (`getSpendingByCategory`
and `searchTransactions`' own `byCategory`).

The two filters budgettracker has no equivalent for were checked against the Overview's label
breakdown instead: label TNVS gives 18 rows / 4,781.80, the same figure `getLabelBreakdown` reports.
Card filtering gives 138 rows on cash and 0 on BPI, which is right: no September row was put on the
card.

### Acceptance, checked
| Check | Result |
|---|---|
| Current month, and a past month via `?month=2026-09` | Both render |
| Numbers match budgettracker | Three figures above, plus two more |
| Pagination | 50 per page, "51-100 of 140", page 3 holds the remaining 40; totals stay over the whole set |
| Day grouping and subtotals | 11 groups in September, each with its own subtotal; income rows green with a `+` |
| Filters | Label, card, category, type, search, min/max and ranges all narrow the list and the header totals |
| Drawer | `?tx=` opens a read-only panel with provenance, labels, the bill and the scanned receipt |
| `j` / `k` / Enter | Move through rows, skip day headings, open the selected row |
| `/` and Esc | Focus the filter field; clear the filters |
| Loading | Streamed HTML cut at 3s against a 6s query already carries `aria-busy="true"` |
| Error | Forced throw: headline, digest, "Try again"; never falls back to the empty state |
| Empty | Two distinct states: "No rows match these filters" and "Nothing logged in November 2026" |
| 390 / 768 / 1440, light and dark | No horizontal page scroll; only the table scrolls. Labels and Source hidden below 700 |
| `next build` | Passes |

Three defects found and fixed while checking: filter groups collapsed to slivers inside the
horizontal scroller (`FilterGroup` needed `shrink-0`); the pagination landmark was also called
"Pages", which is the shell's mobile tab row; and the amount inputs pushed the whole page sideways
at 390, which the design forbids.

## Reports, as built (Nov 2026)
The third page. Overview, Ledger and Reports are done; five remain.

**`fetchReports` (`src/server/queries/reports.ts`)** reads both halves over one window so the bars
and the matrix columns line up: bt `getMonthlySummary` for the monthly totals, dense
`fetchCategoryByMonth` for the matrix. `timezoneOffset` goes into both explicitly; defaulted to
UTC it moves a UTC+8 user's late-evening rows into the neighbouring column.

`?months=3|6|12` picks the range and `?month=` the month it ends at, both URL parameters so a view
is linkable. `getMonthlySummary` only counts back from today, so the page asks for enough months
to reach the end month and keeps the window ending there.

**Shared helper extracted.** `monthsApart`, `monthsEndingAt` and `isEmptyMonth` moved from
`overview.ts` to `src/server/queries/monthly.ts`; Overview now uses them too, so there is one
definition of "the N months ending at M" and of what an empty month is.

**`HeatTable` gained `summary` rows** for the plan's Total spend / Income / Net. They sit outside
the heat scale on purpose: the shade measures one category against another, and a column total is
a different quantity on the same axis. A month with no rows prints what the row asks for -- blank
for the totals, "no data" for Net -- never a zero.

**Not applicable here:** omitting budget figures without a plan belongs to the Overview. Reports
shows no budget figures at all.

### Figures spot-checked against budgettracker
budgettracker's own source, same local database, owner role, `timezoneOffset: -480`.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| September column | in 79,953.66, out 81,578.35, net −1,624.69 | identical | `getMonthlySummary` |
| Housing row, Aug and Sep | 23,049.30 and 22,000 | 23,049.30 / 22,000 | `getSpendingByCategory` per month |
| September column total | 81,578.35 | 81,578.35 | `getSpendingByCategory` summed, and the monthly `expenses` |

August 95,313.87, July 59,371.00 and June 72,680.38 match as well, and October and November come
back as genuinely empty.

### Acceptance, checked
| Check | Result |
|---|---|
| Default range, a past month via `?month=`, and 3 / 6 / 12 | All four URLs return 200 and render |
| Numbers match budgettracker | Three figures above, plus three more |
| Empty months | October and November show "no data" on Net and blanks elsewhere, never 0 |
| 390 / 768 / 1440, light and dark | No horizontal page scroll at any width; the range nav wraps on a phone and only the matrix scrolls |
| Loading | Streamed HTML cut at 3s against a 6s query already carries `aria-busy="true"` and both panel headers |
| Error | Forced throw: headline, digest, "Try again"; never a blank chart |
| Empty range | `?month=2025-06&months=3`: "Nothing logged between April 2025 to June 2025" |

## Cards, as built (Nov 2026)
The fourth and fifth pages. Overview, Ledger, Reports and Cards are done; four remain.

**`src/server/queries/cards.ts`** wraps budgettracker's own reads and derives nothing again:
`getCreditAccountSummaries` for the list, `getCreditAccountDetail` for one card's month,
`describeCardInterest` for the untracked-versus-zero distinction, `overallUtilizationOf` for the
portfolio ratio. `timezoneOffset` goes into every call explicitly: which month a purchase falls in
is the user's question, not the container's.

### A card payment is not a transaction
The rule the pages are built around (budgettracker `.claude/rules/cards.md`). A purchase is an
ordinary EXPENSE carrying `credit_account_id` and counts everywhere expenses count; paying the card
is a `CreditPayment` row that lives outside `transactions` entirely, so no expense query needs a
filter to avoid counting the money twice.

What that means here:
- The detail page lists purchases and payments in **two separate panels**, never summed. The
  Payments panel's meta says so on screen.
- The balance block shows them on separate lines, and the only total is the closing balance.
- `src/server/queries/cards.test.ts` pins it against the vendored arithmetic, along with the
  credit-versus-payment distinction, the unclamped utilization and the interest states.
- Verified against the data: September's expense total is 81,578.35 both in budgettracker and here,
  with the month's 5,000 card payment **not** in it. August's 95,313.87 does include the card's
  7,295.28 of purchases -- filtering the dense ledger by card and by cash splits it exactly
  (7,295.28 + 88,018.59 = 95,313.87).

### Other rules kept
- **Only the bar clamps.** `limitBarPercent` rounds and clamps the fill to 0-100 because a bar has
  no width past full; the percentage printed beside it is the server's untouched figure. 81.5%
  prints as 81.5%, and 108.3% would print as 108.3%.
- **Interest: untracked is not zero.** This card has never had an interest row logged, so it reads
  "not tracked". A "0" would present a card carrying 76,566.08 as free to hold.
- **Null is unknown, not zero.** No APR, no minimum and no planned payment are all recorded as
  absent: "none set", never 0. The observed payment is null below three payments -- one transfer is
  not a habit -- and says how many months were actually observed.
- **Archived cards are included**, because deleting a card with history archives it whatever it
  still owes.

### A bug the mirror caught
Deriving the month's closing balance as `opening + purchases - payments - credits` is wrong
whenever the card's own `openingBalanceDate` falls inside the month. This card's recorded balance
of 74,270.80 is dated 6 August, so August opens at 0 and the derived close came out at 7,295.28
instead of 81,566.08 -- short by the whole opening balance. Both bounds are now read the same way,
as a summary `asOf` an instant, and whatever the month's activity does not explain is surfaced as
its own line, "Card opened with". Every month from July to October now reconciles exactly.

### Figures spot-checked against budgettracker
budgettracker's own source, same local database, owner role, `timezoneOffset: -480`.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| BPI owed / limit / available / utilization | 76,566.08 / 94,000 / 17,433.92 / 81.5% | identical | `getCreditAccountSummaries` |
| August on the card | 6 purchases, 7,295.28; no payments | identical | `getCreditAccountDetail` |
| September expense total, with a 5,000 card payment in the month | 81,578.35 | 81,578.35 | `searchTransactions`, confirming the payment is in no expense total |

Also matching: September's card totals (0 purchases, 5,000 paid), interest `everLogged: false`, and
the observed payment staying null at two months observed.

### Acceptance, checked
| Check | Result |
|---|---|
| List, and detail for a past month via `?month=` | Both render; August, September and October all reconcile |
| Numbers match budgettracker | Three figures above, plus three more |
| Loading | Both routes' streamed HTML cut at 3s against a 6s query carries `aria-busy="true"`; the nested detail boundary renders inside the list's |
| Error | Forced throws on both: headline, digest, "Try again", and "All cards" on the detail |
| Empty | A month with no activity still shows the carried-over balance, not a blank page |
| 390 / 768 / 1440, light and dark | No horizontal page scroll; the two-column panels stack below 900 |
| `next build` | Passes |

**Known limitation:** an unknown card id renders the 404 page but the response status stays 200.
The app shell streams before the page body or `generateMetadata` runs, so the status is already
committed; calling `notFound()` from either place does not change it. Measured in `next dev` and
against a production build. A plain missing route still returns a real 404.

## Budgets, as built (Nov 2026)
The sixth page. Overview, Ledger, Reports, Cards and Budgets are done; Bills, Labels and New entry
remain.

**`src/server/queries/budgets.ts`** is thin on purpose: budgettracker's `getBudgetPerformance`
owns the rollover chain, the projection bases, safe-to-spend and the treatment notes, and this app
re-derives none of it. It reaches the database through the vendored prisma shim, so its signature
is `(userId, month, tz)`; the timezone is still passed explicitly, because which days count as
elapsed is the user's question.

The one thing added here is the empty state's look-back: when the month has no plan, the newest
earlier month that does have one is summarised, so the page can say what was last planned rather
than only that nothing is.

### No plan means no plan-derived figures
This is the whole of the page's honesty, and it is not a cosmetic choice. Without a plan
`getBudgetPerformance` still returns `plannedExpenses: 0`, and therefore
`remainingExpenses: -81,578.35` for September and `safeToSpend.perDay: 0` for November. Printed,
those read as *a budget of nothing that has been blown* and *an allowance of nothing per day* --
a worse and quite different claim from "no budget was set".

So the no-plan state shows only what is true without a plan: income logged, spend logged (all of
it unbudgeted), net, and how far through the month it is. Planned, remaining, projected and
safe-to-spend are left out, and the panel says so. **No `BudgetPlan` row exists in the local
mirror for any month**, so this is the state that renders for every month.

The plan path is built in full -- totals strip, allocations table with kind, carry-in, available,
actual, remaining, variance and projection, safe-to-spend, treatment notes and revision history --
and was rendered against a synthetic `BudgetPerformanceData` in a disposable copy to confirm it
works. It has **not** been seen with real data, and this app must never write a plan to find out.

Null is unknown throughout: `variancePct` is `null` when its base is zero and prints "n/a", not
"0%"; `projectedExpenses` is `null` before the month starts and prints "not started".

### Figures spot-checked against budgettracker
budgettracker's own source, same local database, owner role, `timezoneOffset: -480`.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| September: plan | `null` (0 `BudgetPlan` rows in the database) | `null` | `getBudgetPerformance` |
| September actuals | income 79,953.66, spend 81,578.35, all 81,578.35 unbudgeted | identical | `getBudgetPerformance` totals |
| September progress | 30/30 days, 100% elapsed, not partial | identical | `getBudgetPerformance` progress |

The actuals cross-check against a second path too: `getMonthlySummary` reports the same 79,953.66
and 81,578.35 for the month. November agrees as well: 15/30 days, 50% elapsed, `forecastStatus`
`no-activity`.

### Acceptance, checked
| Check | Result |
|---|---|
| Current month, and a past month via `?month=2026-09` | Both render the no-plan state, correctly named |
| Numbers match budgettracker | Three figures above, plus the November progress and a second path on the actuals |
| Data | The plan path rendered against synthetic data; unexercised with real data, as no plan exists |
| Loading | Streamed HTML cut at 3s against a 6s query carries `aria-busy="true"` and both panel headings |
| Error | Forced throw: says the read failed and that this is **not** the same as having no plan |
| Empty | "No budget plan for November 2026", with what is known shown separately |
| 390 / 768 / 1440, light and dark | No horizontal page scroll; the KPI strip goes 2-up below 900 |
| `next build` | Passes |

**Primitive fixed while checking:** `Panel`'s header did not wrap, and its right-hand slot is
`shrink-0`, so a long `meta` squeezed the title to zero width -- at 390 the panel lost its name
entirely. The header now wraps, and the long explanation moved from the meta slot into the body
where it belongs.

## Bills, as built (Nov 2026)
The seventh page. Overview, Ledger, Reports, Cards, Budgets and Bills are done; Labels and New
entry remain.

**`src/server/queries/bills.ts`** wraps budgettracker's own reads: `getUpcomingBills` for what is
due (its variable-bill estimates and its `isOverdue` rule) and `getBillHistory` for settled
occurrences (collapsed per occurrence, lateness in the user's days). `timezoneOffset` goes into
both explicitly: defaulted, "today" becomes UTC's, and between Manila's midnight and UTC's a bill
due today reads as due tomorrow.

The one dense read is the bills' own settings (`reminderDaysBefore`, `isActive`), because
`getUpcomingBills` returns neither and the page has to tell "no bills at all" from "none due".
`getBillHistory` is called with `limit: 2000`: its default of 50 slices the occurrences while its
summaries cover the whole window, so the per-bill tables would fall short of their own counts.

### Bill dates are calendar days
budgettracker `.claude/rules/bills.md`. A due date is stored at midnight UTC and means "the 5th"
for everyone, so the page works from `localDueDate` / `localSnoozeUntil` and formats them in UTC
(`formatDayKey`). Nothing is shifted by the offset. Only two things are the user's: "today", from
the vendored `userToday(tz)`, and the day a bill was paid (`localActionDate`), which is an instant.
Days until due is arithmetic on the two keys, so it is whole by construction
(`src/lib/bills.ts`, 10 tests, including the 04:00-Manila-is-still-yesterday-in-UTC case).

### What is on the page
- `?days=7|14|30` (default 30) for how far ahead, `?months=3|6|12` (default 6) for the history.
  Both are URL parameters; anything else falls back to the default.
- KPI strip: overdue, due in the window, active bills, paid, paid late, skipped.
- Due: overdue first, then the window, each section with its subtotal. A variable bill's amount
  reads "about" (`≈` on a phone) with its basis, never as a flat assertion (budgettracker #217).
- History: one panel per bill, worst average lateness first, as `getBillHistory` orders them.
  The paid column is what the linked transaction recorded, not the bill's current amount.
  Early payments stay early ("1 day early"), never clamped to on time.
- Read-only: paying, skipping and snoozing go through budgettracker's `settleBill`; the page
  links there.

### Figures spot-checked against budgettracker
budgettracker's own source at `a9639d0`, same local database, owner role, `timezoneOffset: -480`,
on 15 November 2026.

| Figure | Dense | budgettracker | Source compared |
|---|---|---|---|
| Overdue total | 5 bills, about 36,163.00 | 36,163, `totalIsEstimate: true` | `getUpcomingBills` |
| Meralco | due Oct 5, about 5,990.00 from the last payment, 41 days overdue | 5,990, `last-payment`, `2026-10-05`, overdue | `getUpcomingBills` |
| DMCI Water, 6 months | 4 paid, 3 late, average 41 days late, worst 90 | identical | `getBillHistory` |

Also matching: BRV's Jul 5 occurrence paid Sep 6, 63 days late, 5,400.00; Meralco's Jul 5 paid
Jul 6, 1 day late, 9,970.00; the window May 15 to Nov 15, 2026. Every due date renders on its
stored day (Oct 5, not Oct 4).

### Acceptance, checked
| Check | Result |
|---|---|
| Data | Five bills, all overdue; five history panels |
| Numbers match budgettracker | Three figures above, plus three more |
| Loading | Streamed HTML cut at 3s against a 6s read carries `aria-busy="true"` |
| Error | Forced throw: "Could not read your bills", digest, "Try again"; never the empty state |
| Empty | Three variants, each forced: "No bills set up", "Nothing due in the next 30 days", "No occurrences paid, skipped or snoozed in this window" |
| 390 / 768 / 1440, light and dark | No horizontal page scroll and no table overflowing its panel. Due shows Bill / When / Amount at 390, adds Due at 768, all six at 1440 |
| `next build` | Passes |

**Not exercised locally:** a snoozed occurrence. The mirror has 33 PAID logs and 1 SKIPPED and no
SNOOZED, so the "Snoozed to <day>" and "after N snoozes" paths are built and typed but unseen.

### Primitive fixed while checking
`DataTable`'s subtotal row put its label in one cell with `colSpan` over every leading column.
A `colSpan` still reserves a track for each column it covers, hidden ones included, so at 390 the
Due table was 480px wide in a 364px panel and the amounts sat off-screen. The row now renders one
cell per column, each with that column's hide class, and the label sits in a zero-width box that
runs across the empty cells beside it. The Ledger's day groups use the same row and benefit too.
`hideBelow` also gained `"desk"` (900px) beside `"wide"` (700px).
