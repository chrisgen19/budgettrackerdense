# 05 Design system

Goal: turn mockup 04 into tokens and primitives so every page is assembled, not hand-styled.
Source of truth: `design-reference/04-data-dense.html` (open it per `design-reference/README.md`).

## Tokens (Tailwind 4, `src/app/globals.css`)
Define CSS variables once, expose them through `@theme`, switch with a `.dark` class on `<html>`
(class strategy so the user can toggle; default follows `prefers-color-scheme`). Confirm the
Tailwind 4 syntax for `@theme` and custom dark variants against the installed version.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F5F2` | `#12161B` | page (ledger paper) |
| `--panel` | `#FFFFFF` | `#181D23` | panels, sticky bars |
| `--rule` | `#D8DBD4` | `#2A313A` | panel borders, header rules |
| `--rule-2` | `#ECEEE9` | `#20262D` | row rules, inner dividers |
| `--ink` | `#15181C` | `#E3E7EC` | text |
| `--muted` | `#565C64` | `#929BA6` | secondary text (AA on panel and bg in both modes) |
| `--accent` | `#1F5FD1` | `#79A8FF` | selection, focus, active nav |
| `--accent-soft` | `rgba(31,95,209,.10)` | `rgba(121,168,255,.14)` | row hover, active nav bg |
| `--income` | `#17704A` | `#52C892` | income figures |
| `--expense` | `#B0282B` | `#FF8078` | over budget, negative deltas |
| `--warn-bg` | `#FCECEC` | `rgba(255,128,120,.10)` | over-budget flag |
| `--heat` | `31 95 209` | `121 168 255` | heat-table cell shading (`rgb(var(--heat) / a)`) |

Contrast was checked in the mockup: every text pair is at least 5.7:1 (light) and 6.0:1 (dark).
Keep a test (`src/lib/contrast.test.ts`) that recomputes the ratios from the token values so a
later tweak cannot silently drop below 4.5.

Shape: radius 4px everywhere, 1px rules, no shadows. Spacing on a 4px base; table rows 28px;
panel padding 8 to 14px.

## Type
- IBM Plex Sans Condensed 400/500/600 for UI; IBM Plex Mono 400/500 for **every** number.
  Load both with `next/font/google` (self-hosted at build time, no runtime Google request).
- Scale: 11 (labels), 12 (table headers, meta), 13 (body), 15 (section), 16 (KPI value),
  20 (page title). The mockup has no larger type; density is the point.
- No all-caps eyebrow labels. Page titles in sentence case.

## Primitives (`src/components/ui/`)
| Component | Notes |
|---|---|
| `Panel` | header slot (title + muted meta + right actions), body, optional flush table |
| `DataTable` | sticky header, 28px rows, numeric columns right-aligned mono, optional subtotal rows (`tr.sub`), horizontal scroll wrapper, `hideBelow` per column |
| `KpiStrip` / `Kpi` | 6 cells desktop, 2 per row mobile; label, value, optional sparkline, small sub line |
| `MoneyCell` / `Money` | formats `₱12,345.00`, sign handling (`−` U+2212), income/expense colour, privacy mask hook later |
| `Delta` | `+1,998` red / `−6,096` green for spend deltas; zero is muted with no sign |
| `FilterToken` | toggle button, `aria-pressed`, groups with a muted group label (Date, Cat, Label, Card) |
| `Kbd` | shortcut hint |
| `Flag` | the over-budget strip |
| `EmptyState`, `ErrorState`, `Skeleton` | Skeleton mirrors each panel's shape (lines of 10px bars), not a spinner |

## Charts (`src/components/charts/`), plain SVG
Port from `design-reference/shared/core.js` (`charts` object). Server components where possible
(pure SVG strings from data), `"use client"` only for hover tooltips.
- `Sparkline(values, { w, h, color, dot })`
- `BurnChart(cum, budget)`: cumulative spend, dashed budget line, dotted pace line, dot where the
  budget is crossed. When there is no budget plan, draw no budget/pace lines and say so in the
  panel meta.
- `DayBars(cum, limit)`: daily spend, red above 2x pace.
- `MonthBars(monthly)`: income vs spend per month; months with no rows show "no data", not zero.
- `HeatTable(rows, months)`: cell background `rgb(var(--heat) / share*0.35)`.
Every chart has `role="img"` and an `aria-label` summarising it, plus the underlying numbers
available in an adjacent table (the dense layout already does this).

## Shell (`src/app/(app)/layout.tsx`)
- Desktop (>= 900px container width): 196px sticky sidebar (brand + month, nav with kbd hints,
  Accounts group: Cards, Budgets, Bills, Labels; footer with `/` search, `?` shortcuts, theme).
  Sticky command bar on top linking to New entry (`⌘K`).
- Mobile: top bar with brand + command bar, horizontal scrolling tab row; tables scroll
  horizontally inside their panel. Do not invent a different mobile design; the main app is the
  phone app.

## Keyboard layer (`src/lib/keyboard.ts` + a client provider)
| Keys | Action |
|---|---|
| `g o` / `g l` / `g r` / `g c` / `g u` / `g b` / `g t` | Overview / Ledger / Reports / Cards / Budgets / Bills / Labels |
| `n` or `⌘K` | New entry |
| `/` | focus the page's search field |
| `j` / `k` | move row selection in a DataTable; `Enter` opens detail |
| `t` | toggle theme |
| `?` | shortcut sheet (dialog) |
| `Esc` | clear filters / close dialog |
Ignore keys while focus is in an input, textarea or contenteditable. Unit-test the sequence
matcher (`g` then `o` within 1s).

## Acceptance
- A `/dev/kitchen-sink` page (dev only) renders every primitive and chart in both themes.
- Visual comparison against the mockup at 1440 and 390 in light and dark (screenshots).
- Contrast test passes; keyboard matcher tests pass; focus is visible on every interactive element.
