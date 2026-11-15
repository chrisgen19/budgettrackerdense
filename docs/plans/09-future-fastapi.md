# 09 Future: FastAPI as the CRUD API

Reference only. Nothing here is built in v1.

## Does a future FastAPI change today's design?
Yes, in two places, both already in the plans:
1. **One write seam.** All writes go through `src/server/writes.ts`. When FastAPI exists, only that
   file changes: `createQuickEntry` becomes an authenticated `POST` to the API instead of a call
   to vendored `createTransactionBatch`. Pages, the parser and the UI do not move.
2. **Provenance per surface.** `DENSE` is its own `TransactionSource`. FastAPI should get its own
   value (for example `API`), or accept the caller's surface and record it, so a row's origin
   stays answerable.

## The risk to manage: three writers
Today the create rules (label schedules, type-filtered labels, card-purchase rule, idempotency
with advisory locks, category ownership under row locks) live once, in budgettracker's
`createTransactionBatch`. This app reuses that exact code. A Python FastAPI service cannot import
TypeScript, so it would be a **reimplementation**, and three writers with two implementations will
drift.

The safer target is **one owner of writes**:
- Either FastAPI becomes the only writer and budgettracker, the MCP server, Telegram and this app
  all call it (the rules move to Python once, with the TypeScript copies deleted);
- Or budgettracker exposes its existing write path over HTTP and FastAPI is read-focused.

Whichever is chosen, migrate one caller at a time behind its seam, and port budgettracker's verify
scripts (`verify-batch-idempotency.ts`, `verify-transaction-update.ts`,
`verify-telegram-miniapp.ts`) as the acceptance suite for the new writer, since they test the
database behaviour (locks, replays, schedules) that unit tests stub out.

## Reads
Reads can stay direct to the database (fast, simple) even after writes move behind an API. If
FastAPI takes over reads too, the vendored read queries here are replaced by API calls in
`src/server/queries/` and `src/vendor/bt` shrinks or goes away.

## When it happens
- Add `API_BASE_URL` and a service token to this app's env.
- Replace the body of `createQuickEntry`; keep its signature and `WriteResult` shape.
- Map the API's error codes onto `retryable` (4xx: not retryable, the request is wrong; 5xx or
  network: retryable with the same `clientBatchId`).
- Remove `INSERT` from the `dense_app` role once nothing here writes directly.
