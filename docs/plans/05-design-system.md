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

## As built (Nov 2026)
What was built, and the places the mockup had to be adapted rather than copied.

**Tailwind 4.3.3, verified not remembered.** The syntax was checked by compiling `globals.css`
with the installed compiler before any component was written:
- `@custom-variant dark (&:where(.dark, .dark *));` emits `.dark\:x:where(.dark, .dark *)`, so a
  subtree can be dark inside a light page. That is what lets `/dev/primitives` show both themes in
  one screenshot.
- `@theme inline` is what the token block needs. Without `inline`, every utility bakes in the
  light value; with it, utilities emit `var(--ink)` and the `.dark` block re-points them all.
- `--breakpoint-wide: 700px` / `--breakpoint-desk: 900px` reproduce the mockup's two
  `@container stage` queries as media queries (here the shell *is* the page, so there is no stage
  to measure). **Only these two are used.** Tailwind sorts custom pixel breakpoints before the
  built-in rem ones, so mixing `sm:` with `wide:` would cascade in the wrong order.

**Fonts.** `IBM_Plex_Sans_Condensed` and `IBM_Plex_Mono` from `next/font/google`, with explicit
`weight` arrays (400/500/600 and 400/500): neither has a variable axis in this Google release, so
a weight that is not listed is not downloaded. Both are self-hosted at build time, which is why
the CSP added in plan 04 needs no font exception. Verified in the browser:
`font-family` resolves to `"IBM Plex Sans Condensed", "IBM Plex Sans Condensed Fallback", ...`.

**Theme switching** is a `.dark` class on `<html>`, applied before first paint by a small inline
script (`src/lib/theme.ts`), with `localStorage` holding `light`/`dark` and nothing meaning
"follow the OS". `useThemeToggle` holds no React state: the theme lives on the document element,
and mirroring it into state only buys a render that renders nothing new.

**Contrast.** `src/lib/contrast.ts` computes WCAG ratios, `src/lib/tokens.ts` mirrors the token
values, and `src/lib/tokens.test.ts` parses `globals.css` to assert the mirror is honest -- so the
34 pair assertions in `contrast.test.ts` measure what is actually painted. Every pair clears AA.
The measured minimums are **5.31 light** (accent on bg) and **4.69 dark** (muted on a hovered
row); the plan quoted 5.7/6.0 for a smaller set of pairs that left those two out.

**Keyboard.** `src/lib/keyboard.ts` is the pure matcher and the map; the provider
(`src/components/shell/keyboard-provider.tsx`) feeds it keys. A prefix is always consumed, so
`g x` is a miss rather than a fresh `x` -- which matters, because `t` alone toggles the theme and
`g t` goes to Labels. Row commands (`j`/`k`/`Enter`) are forwarded as a DOM CustomEvent
(`src/lib/row-commands.ts`) and handled by `<RowSelection>`, which moves a `data-selected`
attribute rather than React state: a highlight should not re-render a 300-row table.

### Deviations from the mockup, and why
| Change | Why |
|---|---|
| `/dev/primitives`, not `/dev/kitchen-sink` | Christian asked for that path. Dev only: `notFound()` when `NODE_ENV === "production"`. |
| `MonthBars` month labels are HTML under the plot, not `<text>` inside it | The plot stretches with `preserveAspectRatio="none"`, which widens glyphs by however much wider the panel is than the 520pt viewBox. Legible in the mockup's column, badly distorted in a 1200px panel. Bars are rectangles and do not care; text does. |
| `DataTable` has `hideHeader`, which renders `<thead>` `sr-only` | The mockup's "Recent" panel simply omits the header row. Hiding it visually keeps the columns named for a screen reader; the point is density, not stripping the table's meaning. |
| `Money` takes an explicit `tone`, not one derived from the sign | In the mockup an expense is plain ink with a `−` and only income is green. The caller says what the number *means*. |
| `--accent-ink` token added | The mockup hard-codes `#fff` on the accent and overrides it to `#0B1220` in dark (`.d-opt`, `.d-save`). That is a token, so it is one here. |
| `Sparkline` is `aria-hidden` unless given a `label` | Beside a KPI it repeats a figure already in the text. The larger charts all carry `role="img"` and a summarising `aria-label`. |

### Acceptance, checked
Screenshots at 1440 and 390, light and dark, compared side by side against the mockup served from
`design-reference/` (Overview screen, both widths).

| Check | Result |
|---|---|
| `/dev/primitives` renders every primitive and chart in both themes | Yes, light above and dark below on one page |
| Shell at 1440 | 196px sidebar, `grid-template-columns: 196px 1244px`, mobile tab row hidden |
| Shell at 390 | Sidebar hidden, tab row shown, KPI strip 2-up, **no horizontal page scroll** (`scrollWidth === 390`); only the tables scroll, inside their own wrappers |
| Fonts | Both Plex families resolve, self-hosted |
| Contrast test | 34 pairs, all at or above 4.5 |
| Keyboard matcher tests | 11 tests, including the 1s prefix expiry and prefix consumption |
| `?` sheet | Opens, groups as Go to / Actions / Rows, closes on Escape |
| `t` | Toggles `.dark` and back |
| `j` / `k` | Move the selection through `[data-row]`, highlight is `rgba(31, 95, 209, .1)` |
| `/` | Focuses the field carrying `data-search-field` |
| Keys while typing | Ignored: `t` in the search field does not toggle the theme |
| `g l` | Navigates (to `/ledger`, a 404 until plan 06) |
| Focus ring | `2px solid rgb(31, 95, 209)` on interactive elements |
| `next build` | Passes, including the TypeScript pass |

### Notes for the next phase
- `/ledger`, `/reports`, `/new`, `/cards`, `/budgets`, `/bills`, `/labels` are linked from the
  shell and the keyboard map but do not exist yet: plan 06.
- `src/app/(app)/dev/primitives/sample-data.ts` holds the mockup's September 2026 figures. It is
  only read by that page; phase 06 wires the same components to `src/server/queries`.
- The Overview page is still a placeholder, now inside the shell and using the primitives.
