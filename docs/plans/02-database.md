# 02 Database

Goal: a generated Prisma client for the shared database, a least-privilege role, and a guard that
makes it impossible for this app to change the schema.

## The rule
budgettracker owns the schema. Its migrations run only from its own `pnpm build:deploy` on Coolify
(see budgettracker `AGENTS.md`, issue #192 history). This app **reads the schema file and nothing
else**. It never runs `prisma migrate`, `prisma db push`, or writes a `prisma db pull` result.

## Steps
1. `scripts/sync-schema.ts` (run with `tsx`):
   - Reads `BUDGETTRACKER_DIR` (default `../budgettracker`), copies `prisma/schema.prisma` to
     `prisma/schema.prisma` here, prepending a header comment:
     `// GENERATED from budgettracker@<git short sha>. Do not edit. Run pnpm sync:schema.`
   - Records the source sha in `prisma/.source-sha`.
   - Then runs `prisma generate`.
   - Script: `"sync:schema": "tsx scripts/sync-schema.ts"`.
2. `src/server/db.ts`: Prisma client singleton (same global-cache pattern as budgettracker
   `src/lib/prisma.ts`), `import "server-only"`.
3. Never-migrate guard, `scripts/no-migrations.test.ts` (node environment):
   - `prisma/migrations` does not exist.
   - No `package.json` script contains `migrate`, `db push`, `db pull` or `db execute`.
   - `prisma/schema.prisma` starts with the GENERATED header.
4. `.env.example`:
   ```
   DATABASE_URL="postgresql://dense_app:CHANGE_ME@localhost:5432/<budgettracker db name>"
   SESSION_SECRET=""            # plan 04
   ALLOWED_EMAILS=""            # plan 04
   BUDGETTRACKER_DIR="../budgettracker"
   ```
   Read the real database name from budgettracker's `.env` `DATABASE_URL` (do not copy the owner
   credentials).

## The `dense_app` role
Create locally first, as the database owner, from `psql`. Production gets the same script by hand
in the Coolify Postgres terminal (plan 08).

```sql
CREATE ROLE dense_app LOGIN PASSWORD '<generate>';
GRANT CONNECT ON DATABASE <db> TO dense_app;
GRANT USAGE ON SCHEMA public TO dense_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dense_app;
-- future tables from budgettracker migrations stay readable:
ALTER DEFAULT PRIVILEGES FOR ROLE <owner role> IN SCHEMA public GRANT SELECT ON TABLES TO dense_app;

-- the one write: quick entry through createTransactionBatch
GRANT INSERT ON transactions, transaction_labels TO dense_app;
-- the row lock createTransactionBatch takes on the category (see "Final grants" below)
GRANT UPDATE (created_at) ON categories TO dense_app;
```

### As created locally (Nov 2026)
Database `budgettracker-nextjs`, owner role `myuser`, Postgres 17.11. The script above ran
verbatim with those names substituted. Two facts checked against the live database first:

- There are **no sequences** in `public` and neither `transactions` nor `transaction_labels` has an
  identity column (ids are Prisma-side cuids), so no `GRANT USAGE ON SEQUENCES` is needed.
- `GRANT SELECT ON ALL TABLES` also covers `_prisma_migrations`. Read-only, left as is.

`TransactionSource` gained `DENSE` with budgettracker PR #409 (`202e6de`, plan 07 step 0).

### Final grants, proven against local (15 Nov 2026)
| Privilege | Why |
|---|---|
| `CONNECT` on the database, `USAGE` on `public` | To log in and see the schema |
| `SELECT` on every table, and on future ones through the default privileges | Every page reads; the login reads `users` |
| `INSERT` on `transactions`, `transaction_labels` | The one write, `createTransactionBatch` |
| `UPDATE (created_at)` on `categories` | The category row lock, below |

**Why the column grant.** Inside the keyed write, `categoriesAreUsableForWrite` reads the category
with `SELECT ... FOR KEY SHARE` (vendored `transaction-writes.ts:195`), so a category cannot change
type between the check and the insert. Postgres requires `UPDATE` privilege on at least one column
for **any** row-locking read, even the weakest. Without it the write fails with `permission denied
for table categories`, which `createTransactionBatch` catches and reports as
`UNKNOWN_WHETHER_SAVED`: the real cause never reaches the page.

The column is `created_at` because it is the only one on `categories` that means nothing. The
earlier guess here, `updated_at`, does not exist on that table, whose columns are `id, name, type,
icon, color, is_default, user_id, created_at`. Nothing in budgettracker reads a category's
`created_at`, so the worst this grant allows is rewriting a timestamp no one looks at. The advisory
lock on the batch key (`pg_advisory_xact_lock`) needs no grant.

Apply it with the database named explicitly. The first attempt connected to the owner's default
database and granted nothing on this one:

```sql
-- psql -h localhost -U myuser -d budgettracker-nextjs
GRANT UPDATE (created_at) ON categories TO dense_app;
-- check: dense_app=w/myuser on created_at
SELECT attname, attacl FROM pg_attribute
WHERE attrelid = 'public.categories'::regclass AND attacl IS NOT NULL;
```

**What the role must not have, checked as `dense_app` after the grant.** Each statement below ran
with `WHERE false`, so a refusal is the privilege check and nothing else:

| Statement | Result |
|---|---|
| `SELECT ... FOR KEY SHARE` on `categories` | allowed (the point of the grant) |
| `UPDATE categories SET created_at` | allowed (the grant itself) |
| `UPDATE categories SET name`, `INSERT INTO categories`, `DELETE FROM categories` | permission denied |
| `UPDATE` / `DELETE` on `transactions` | permission denied |
| `UPDATE` / `DELETE` on `transaction_labels` | permission denied |
| `UPDATE labels`, `UPDATE users` | permission denied |
| `CREATE` on schema `public` | not held |

### Plan 07 manual checks, as `dense_app` (15 Nov 2026)
Run through the real seam (`createQuickEntry` in `src/server/writes.ts`, via
`tsx --conditions=react-server`) against local, with ₱1 entries described "plan 07 check".

| Check | Result |
|---|---|
| No label named, dated Fri 13 Nov 10:30, inside Work Budget's schedule (Mon to Fri 05:00 to 17:00) | Saved with **Work Budget** applied by the schedule; stored `02:30Z`, 10:30 Manila |
| `#bpi` on an INCOME entry | Refused, `CARD_NOT_USABLE`, nothing written |
| The same `dense-` key saved twice | First `replayed: false`, second `replayed: true` with the same id; **1** row under the key |

Before the grant, checks 1 and 3 failed with `UNKNOWN_WHETHER_SAVED` and wrote nothing, which is
how the missing privilege was found. The two saved rows stay in the local mirror
(`created_via = DENSE`, ₱1 each, 13 Nov); `dense_app` cannot delete them, by design.

**Production needs the same column grant** before writes are turned on there (plan 08), applied
the same way, in the Coolify Postgres terminal, as the owner.

Note: `SELECT` on `users` includes the `password` hash column, which the login needs (plan 04).
That is the main reason this role's password must be treated like the owner's.

## Facts Prisma's schema does not show
- Partial unique index on default categories: `(name, type) WHERE user_id IS NULL`
  (budgettracker migration `20260828100000`). Defaults have `userId = null`; a user's categories
  are `OR: [{ isDefault: true }, { userId }]`.
- Case-insensitive label uniqueness is app logic plus a `LOWER(name), user_id` index
  (migration `20260405120000`).
- `BudgetAllocation.amount` is `Decimal(14,2)`, the only Decimal money column. Every other
  `amount` is `Float`.
- `transactions.mcp_token_id` is deliberately not a foreign key.
- Timezone: `users.timezone_offset` in `getTimezoneOffset()` minutes (UTC+8 = -480).
- Credit card balances are derived, never stored; a card payment (`credit_payments`) is not a
  transaction.

## Acceptance
- `pnpm sync:schema` produces `prisma/schema.prisma` with the header and a generated client.
- `scripts/no-migrations.test.ts` passes.
- A throwaway script as `dense_app` reads `prisma.user.count()` and the latest transaction.
- As `dense_app`, `UPDATE transactions SET amount = amount WHERE false;` fails with
  `permission denied` (proves the missing privilege without touching a row).
