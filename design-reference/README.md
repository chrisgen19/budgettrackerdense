# Design reference

`04-data-dense.html` is the approved visual spec for this app. It was built in the budgettracker
redesign exploration (Nov 2026) and renders with real data from `data/snapshot.js`.

## Opening it
From this folder: `python3 -m http.server 4322` and visit
`http://127.0.0.1:4322/04-data-dense.html`. The top bar switches screens (Dashboard, Transactions,
Quick add, Monthly report), width (1440 / 390), theme and state (data, empty, loading). "Spec"
shows the palette and type.

`data/` holds a snapshot of real financial data and is gitignored. Regenerate it from the
budgettracker repo with `pnpm exec tsx --env-file=.env design-mockups/scripts/snapshot.ts` if
`design-mockups/` still exists there.

## What to lift, and from where
| What | Where in the mockup | Goes to |
|---|---|---|
| Colour tokens, light and dark | `<style>` at the top: `.m { --bg ... }` and `.m[data-theme="dark"]` | `src/app/globals.css` `@theme` + `.dark` (plan 05) |
| Type: Plex Sans Condensed + Plex Mono, sizes 11/12/13/15/20 | `.m` font, `.n`, `.d-kpi dd` | `next/font` in `src/app/layout.tsx` |
| Shell: 196px sidebar with kbd hints, sticky command bar | `.d-side`, `.d-top`, `.d-cmd` | `src/app/(app)/layout.tsx` |
| KPI strip with sparklines | `.d-kpis`, `kpi()` in `dashboard()` | `components/ui/kpi-strip.tsx` |
| Panels and 28px-row tables | `.d-panel`, `.d-t` | `components/ui/panel.tsx`, `data-table.tsx` |
| Burn chart, day bars, sparkline, month bars | `charts.burn`, `charts.dayBars`, `charts.spark`, `charts.bars` in `shared/core.js` | `components/charts/*` |
| Category x month heat table | `report()` | `components/charts/heat-table.tsx` |
| Command-line entry and parse table | `quickadd()` and `after()` | `app/(app)/new/*`, `lib/command-parser.ts` |
| Filter token bar | `transactions()` `.d-bar` | `components/ui/filter-token.tsx` |

Thumbnails: `04-desktop.png`, `04-mobile.png`.

Known gaps in the mockup to resolve in the build: the budget is a sample (5-month average) because
no `BudgetPlan` existed for the snapshot month; the real app reads `getBudgetPerformance` and shows
"no plan" honestly when there is none.
