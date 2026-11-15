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
```

**Privileges to verify, not assume.** `createTransactionBatch` takes row locks
(`categoriesAreUsableForWrite` uses `FOR KEY SHARE` on `categories`) and an advisory lock on the
batch key. Row-lock clauses need the `UPDATE` privilege on the table. Run the quick-entry path
as `dense_app` against local in phase 07 and grant **only** what the error names, most likely
`GRANT UPDATE (updated_at) ON categories TO dense_app;` (a column grant is enough for the lock and
lets the role change nothing meaningful). Record the final grant list here once proven.

What the role must **not** have, checked in acceptance: `UPDATE`/`DELETE` on `transactions`,
anything on `users` beyond `SELECT`, `CREATE` on the schema.

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
