# 07 Quick entry (the one write)

Goal: type `241 transpo @tnvs indrive v mall to mirea`, confirm with chips, press Enter, and get a
transaction exactly like one created in budgettracker, tagged `created_via = DENSE`.

## Step 0, in budgettracker (do first, separate PR there)
Add the enum value. This is a change to the schema owner, so follow **its** rules
(`budgettracker/.claude/rules/deploys.md`: expand/contract, the old release serves while
`build:deploy` migrates).

1. Branch in budgettracker: `feature/dense-transaction-source`.
2. `prisma/schema.prisma`: `enum TransactionSource { APP MCP TELEGRAM DENSE }`.
3. Migration (create with `pnpm db:migrate` locally): `ALTER TYPE "TransactionSource" ADD VALUE 'DENSE';`
   Expand-only: no existing row or code path changes.
4. Make budgettracker **read** DENSE rows correctly. Grep for `TransactionSource`, `"TELEGRAM"`
   and `createdVia` and update every exhaustive list, for example:
   - `src/lib/budget-query-types.ts` `SearchTransactionsParams.createdVia` union
   - MCP tool input schemas that enumerate sources
   - any UI badge or label for the source (transaction row badges)
5. Order matters: a Prisma client generated **without** DENSE throws when it reads a DENSE row.
   So the budgettracker release containing DENSE must be **deployed to production before** the
   dense app writes a single row there. Locally the same: migrate first.
6. Run budgettracker's `pnpm lint && pnpm type-check && pnpm test`, PR, merge, let Coolify deploy.

Back here: `pnpm sync:schema && pnpm sync:vendor`, then the guard below turns writes on.

## Write seam `src/server/writes.ts`
```ts
import "server-only";
export type QuickEntryInput = {
  type: "EXPENSE" | "INCOME";
  amount: number;
  categoryId: string;
  labelIds?: string[];          // undefined = let label schedules decide; [] = explicitly none
  creditAccountId?: string | null;
  description: string;
  date: string;                 // as accepted by vendored resolveTransactionDate
};
export type WriteResult =
  | { ok: true; transactionId: string; replayed: boolean }
  | { ok: false; reason: string; retryable: boolean };

export async function createQuickEntry(userId: string, input: QuickEntryInput, clientBatchId: string): Promise<WriteResult>
```
Implementation calls vendored `createTransactionBatch({ prisma, userId, items: [input],
clientBatchId, createdVia: "DENSE" })` and maps its result. Nothing else in the app writes.
Plan 09 swaps this implementation for an HTTP call; the signature stays.

**Writes-enabled guard:** at startup (or first call), check that the generated Prisma enum
contains `DENSE` and that the database accepts it
(`SELECT 'DENSE'::"TransactionSource"` succeeds). If not, `createQuickEntry` returns
`{ ok: false, reason: "DENSE_NOT_DEPLOYED", retryable: false }` and the page disables Save.

## Rules that must carry over (from budgettracker `.claude/rules/transactions.md`)
- `labelIds` **omitted** when the user named no label, so time-of-day label schedules auto-apply.
  `[]` only when the user explicitly cleared labels. Explicit ids are deduped and type-filtered by
  `createTransactionBatch` itself.
- `creditAccountId` only on an EXPENSE (`checkCardPurchases` refuses otherwise; surface its reason).
- Category must be the user's own or a default, and its type must match (checked inside the write).
- Idempotency: generate `clientBatchId` (UUID) when the entry form mounts and keep it until a save
  succeeds. A lost response retried with the same key replays instead of duplicating. Prefix it
  `dense-` for traceability.
- Dates: a bare `YYYY-MM-DD` gets the current clock time via `resolveTransactionDate`; "today" with
  no date sends the current local datetime.

## Command parser `src/lib/command-parser.ts` (pure, new code)
budgettracker's `src/lib/telegram/shorthand.ts` only detects whether text is plain shorthand; the
actual Telegram parsing goes through Gemini. So this parser is new, deterministic, and fully unit
tested. Grammar, tokens in any order:

| Token | Meaning |
|---|---|
| `241`, `241.50`, `1,250` | amount (first numeric token) |
| `+5000` | amount and type INCOME |
| word matching a category name prefix (case-insensitive, quick categories first) | category |
| `@tnvs`, `@family` | label by name prefix, spaces removed (`@withmom`) |
| `#bpi` | card by name prefix |
| `y`, `yesterday`, `mon`..`sun` (most recent past), `9/27`, `2026-09-27` | date |
| anything else | description |

Ambiguity is never guessed: two matching categories or labels leave the field unset and show both
as highlighted chips to pick from. The parse table (mockup 04) shows every field; chips stay
editable and **the chips, not the text, are what gets saved**. Use the user's real categories,
labels and cards (vendored `getCategoryList`, `getLabelList`, card summaries) loaded once per page.

Optionally reuse `budgettracker/src/lib/telegram/category-match.ts` if it is pure; check its
imports before adding it to the vendor entry list.

## UI `/new`
- Command input autofocused; parse table below (Amount, Type, Category, Labels, Source, Note, Date)
  with chip rows; `Enter` saves, `Shift+Enter` saves and clears for the next entry, `Esc` clears.
- After save: a one-line confirmation in mono (`✓ saved 2026-09-28 22:36  −241.00  Transportation
  [TNVS]`) and the last 10 entries made here listed below.
- The confirmation stays until the next save, so once the line is edited after a save it reads
  `✓ saved earlier` (`✓ already saved earlier` for a replay). Shift+Enter's cleared line keeps
  `✓ saved` until the next entry is typed. See "Production" below for why (PR 6).
- A note is required: a line with none shows `Add a note.` and Enter does nothing. See "Notes are
  required" below.
- Mobile: the same, chips wrap; no custom keypad (this is the desktop app).

## Tests
- Parser: 30+ cases including ambiguity, income, card, dates around midnight in UTC+8.
- `writes.ts`: maps each `createTransactionBatch` failure reason; guard returns
  `DENSE_NOT_DEPLOYED` when the enum is missing (mock the check).
- Manual, against local as `dense_app`: create one entry with no label during a scheduled label's
  window and confirm the schedule applied; create with `#bpi` as INCOME and confirm the refusal;
  submit twice with the same key and confirm one row. Record the grants it needed in plan 02.

## Acceptance
- An entry made here appears in budgettracker identically, with `created_via = DENSE`.
- Same-key retry creates one row.
- As `dense_app`, nothing on this page can update or delete a row (no such code path exists, and
  the role would refuse anyway).

## Production (2026-11-16)
The first production entry, typed on `https://dense.cgdev.site/new` as
`1 other dense first production test`, saved at 10:01 Manila. Read back as `dense_app`:

| Field | Stored |
|---|---|
| id | `cmwimac300001ny014dbo401e` |
| amount / type / category | 1 / `EXPENSE` / Other Expense |
| labels | `{Work Budget}`, applied by its schedule (Mon to Fri 05:00 to 17:00; no label was named) |
| date | 2026-11-16 10:01 Manila |
| created_via / client_batch_id | `DENSE` / `dense-61e12e97-c76e-4168-bee1-58bf5cf778dc` |
| description | empty (see below) |

November Spent moved from ₱26,295.21 to ₱26,296.21 in the shared table budgettracker reads. The row
is at `https://budget.cgdev.site/transactions?id=cmwimac300001ny014dbo401e`; budgettracker's own
page for it was not checked in this session. `dense_app` cannot delete or edit it; a note can be
added in budgettracker.

**The empty note, and the fix (PR 6).** The parse table's Note row showed `dense first production
test`, but the row saved without it. Traced layer by layer, nothing drops the description: the
parser, `resolveDraft` and `readyToSave` keep it, so do `saveEntry`, `createQuickEntry` and
`createTransactionBatch`, and on a local production build the server action's request body carried
it. What reproduces every detail is Enter pressed at `1 other` (already a valid line) with the note
typed after: the request sent `"description":""`, and the old `✓ saved` line stayed on screen
beside the updated Note row, reading as the save of the full line. PR 6 relabels it
`✓ saved earlier` once the text differs from the line saved
(`src/components/new/entry-form.test.tsx`, the first component test). Saving on the first valid
Enter was left unchanged then, which is what "Notes are required" below closes.

The local reproduction left three ₱1 `DENSE` rows in the local mirror (16 Nov, 10:07 to 10:09).

## Notes are required (2026-11-19)
PR 6 made the stale confirmation honest but left the cause in place: `1 other` is a complete line,
so Enter there still saved a row with no note. `readyToSave` now refuses a line whose note is empty
or blank, with `Add a note.` in the save bar, so the first Enter at `1 other` does nothing and the
note typed after it is what gets saved.

Why a note is required here when budgettracker's own `transactionSchema` defaults it to `""`:

- **Every other way in almost always has one.** On the local mirror (19 Nov): APP 1 empty of 935,
  Telegram 0 of 39, MCP 0 of 49. Both empty `DENSE` rows came from the bug above, not from a choice.
- **The closest analogue already requires it.** budgettracker's quick-log tiles, its other one-line
  entry, reject an empty description (`src/lib/validations.ts`, "Description is required").
- **The rule stays in this app.** Requiring it in the shared `createTransactionBatch` would change
  the contract for budgettracker's web form, batch route and MCP, which all rely on the `""`
  default. So the check is in `readyToSave` and nothing vendored changed: `check:drift` is unaffected.
- **The cost is one word.** A line like `241 transportation` uses its only word as the category and
  now needs a note, which is small for a review tool where the note is what you read back later.

Tests: `src/lib/entry-draft.test.ts` (a line with no note, and one with only trailing spaces) and
`src/components/new/entry-form.test.tsx` (Enter at `1 other` calls no save and shows the problem,
then `1 other taxi` saves once with its note). All three fail with the check removed.

Production row `cmwimac300001ny014dbo401e` still has an empty note; add one or delete it in
budgettracker, since `dense_app` can do neither.
